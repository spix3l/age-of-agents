#!/usr/bin/env python3
"""Author the Matter Deposit sculpt spec on top of the scaffold.

Second authoring (refine-spec): the first spec built every crystal as a textured SPHERE
with a bright-blue glowing albedo, which rendered as two stacked blobs -- a glowing cube
on a dark base -- against a reference showing a cluster of dark faceted shards with thin
cyan fissures. This rewrite changes three decisions:

1. Shards are `lathe` primitives with `latheProfile.segments: 6` (hexagonal obelisks with
   flatShading), not spheres. The generator takes cylinder/cone segment counts from the
   global tessellation tier, so lathe is the only per-component faceting control.
2. The crystal albedo is dark slate (#2a3542, metal 0.15); the cyan moves to emissive
   fissure strips and a central glow pool. A self-lit strip's albedo is not its glow.
3. Per-material `envMapIntensity` from the Core Keep probe (scene 0.15): basalt 0.5,
   crystal 0.8, fissures 0.0.

Reference: art/models/matter.png (153x144). Rear hemisphere inferred, stated as such.
"""
import copy, json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCAFFOLD = HERE / "scaffold.json"
SPEC = HERE / "object-sculpt-spec.json"
DI = HERE / "di.json"

spec = json.loads(SCAFFOLD.read_text())
template = copy.deepcopy(spec["componentTree"][0])
mat_template = copy.deepcopy(spec["materials"][0])


def comp(cid, name, level, role, primitive, topo, rationale, dims, pos, material,
         parent="root", importance=0.6, confidence=0.75, rot=(0, 0, 0),
         geometry=None, evidence=None):
    c = copy.deepcopy(template)
    c.update(id=cid, name=name, level=level, role=role, primitive=primitive,
             topologyClass=topo, topologyRationale=rationale, parent=parent,
             importance=importance, confidence=confidence, material=material,
             materialLayers=[material], evidenceRefs=evidence or ["full-object"],
             details=[], localFeatures=[], attachment=None)
    c["dimensions"] = {"width": dims[0], "height": dims[1], "depth": dims[2],
                       "units": "relative", "confidence": confidence}
    # scale_vector short-circuits on transform.scale if the key exists at all: omit identity.
    c["transform"] = {"position": list(pos), "rotation": list(rot)}
    if geometry:
        c["geometryDescriptor"] = {**c["geometryDescriptor"], **geometry}
    return c


def material(mid, name, color, secondary, palette, rough, metal, env,
             emissive=None, flat=False, notes=""):
    m = copy.deepcopy(mat_template)
    m.update(id=mid, name=name, type="standard", baseColor=color, color=color,
             notes=notes, localOverrides=[])
    m["albedo"] = {"dominant": color, "secondary": secondary,
                   "samplingNotes": "De-lit estimate from art/models/matter.png zones."}
    m["colorVariation"] = {"palette": palette, "pattern": "panelled", "amplitude": 0.08,
                           "heightCorrelation": 0.2}
    m["roughness"] = {"base": rough, "variation": 0.12, "map": "independent-procedural-field",
                      "localResponse": "roughness rises in crevices between shards"}
    m["metalness"] = {"base": metal, "variation": 0.02}
    m["envMapIntensity"] = env
    m["textureResolution"] = 512
    if flat:
        m["flatShading"] = True
    if emissive:
        m["emissive"] = emissive["color"]
        m["emissiveIntensity"] = emissive["intensity"]
        m["emissiveObservation"] = emissive
    return m


HEX_SHARD = {"latheProfile": {
    "points": [[0.30, -0.5], [0.24, -0.1], [0.17, 0.25], [0.10, 0.42], [0.001, 0.5]],
    "segments": 6}}
MOUND_DOME = {"latheProfile": {
    "points": [[0.02, -0.5], [0.48, -0.5], [0.5, -0.2], [0.38, 0.15], [0.18, 0.4],
               [0.02, 0.5]],
    "segments": 10}}

tree = [
    comp("root", "Matter Deposit", "macro", "body", "box", "assembled-solid",
         "Independent shards socketed into a rock mound; tiers separate, nothing shares "
         "a continuous surface.", (0.001, 0.001, 0.001), (0, 0, 0), "basalt",
         parent=None, importance=1.0, confidence=0.9),
    comp("rock-mound", "Basalt mound", "macro", "body", "lathe", "relief",
         "A low irregular dome: lathe with 10 segments reads as rough rock under "
         "flat shading.", (2.4, 0.7, 2.4), (0, 0.3, 0), "basalt",
         importance=0.8, confidence=0.85,
         geometry={"topologyIntent": "low rock dome",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **MOUND_DOME}),
    # --- the shard cluster: tall centre-back, ring of leaners, all faceted hex obelisks ---
    comp("shard-spire", "Central spire", "macro", "body", "lathe", "extruded-solid",
         "The tallest shard, near-vertical; carries the brightest fissure light.",
         (0.62, 1.6, 0.62), (0, 1.1, -0.15), "crystal",
         importance=0.95, confidence=0.85, rot=(0.05, 0.3, 0.03),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    comp("shard-left", "Left leaner", "meso", "body", "lathe", "extruded-solid",
         "Mid shard leaning out front-left.", (0.5, 1.05, 0.5), (-0.72, 0.8, 0.25),
         "crystal", importance=0.7, confidence=0.8, rot=(0.1, 1.2, 0.26),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    comp("shard-right", "Right leaner", "meso", "body", "lathe", "extruded-solid",
         "Mid shard leaning out front-right.", (0.52, 1.12, 0.52), (0.7, 0.82, 0.2),
         "crystal", importance=0.7, confidence=0.8, rot=(-0.08, 2.4, -0.24),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    comp("shard-back-left", "Back-left shard", "meso", "body", "lathe", "extruded-solid",
         "Rear shard, inferred by symmetry; shorter, mostly occluded from the front.",
         (0.46, 0.95, 0.46), (-0.45, 0.72, -0.62), "crystal",
         importance=0.55, confidence=0.6, rot=(0.2, 0.6, 0.14),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    comp("shard-back-right", "Back-right shard", "meso", "body", "lathe",
         "extruded-solid", "Rear shard, inferred by symmetry.",
         (0.48, 1.0, 0.48), (0.5, 0.75, -0.6), "crystal",
         importance=0.55, confidence=0.6, rot=(0.18, 3.6, -0.16),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    comp("shard-front-left", "Front-left stub", "meso", "body", "lathe", "extruded-solid",
         "Low front stub breaking the mound rim.", (0.4, 0.62, 0.4), (-0.35, 0.55, 0.72),
         "crystal", importance=0.5, confidence=0.7, rot=(0.3, 2.0, 0.1),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    comp("shard-front-right", "Front-right stub", "meso", "body", "lathe",
         "extruded-solid", "Low front stub.", (0.38, 0.58, 0.38), (0.42, 0.52, 0.68),
         "crystal", importance=0.5, confidence=0.7, rot=(-0.28, 4.4, -0.12),
         geometry={"topologyIntent": "hexagonal obelisk",
                   "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1},
                   **HEX_SHARD}),
    # --- emissive fissures: thin strips laid between/over the shards, never whole faces ---
    comp("fissure-spire", "Spire fissure", "micro", "detail", "box", "decal",
         "The brightest crack running up the central spire's front face.",
         (0.07, 0.9, 0.04), (0.02, 1.15, 0.16), "fissure",
         importance=0.85, confidence=0.8, rot=(0.05, 0, 0.04)),
    comp("fissure-left", "Left fissure", "micro", "detail", "box", "decal",
         "Crack along the left leaner's inner face.", (0.06, 0.6, 0.04),
         (-0.5, 0.85, 0.3), "fissure",
         importance=0.6, confidence=0.7, rot=(0.1, 0.5, 0.3)),
    comp("fissure-right", "Right fissure", "micro", "detail", "box", "decal",
         "Crack along the right leaner's inner face.", (0.06, 0.62, 0.04),
         (0.48, 0.88, 0.28), "fissure",
         importance=0.6, confidence=0.7, rot=(-0.08, -0.5, -0.28)),
    comp("fissure-mound-left", "Mound fissure left", "micro", "detail", "box", "decal",
         "Glowing crack where the left shards meet the mound.", (0.4, 0.035, 0.05),
         (-0.55, 0.62, 0.35), "fissure",
         importance=0.55, confidence=0.65, rot=(0, 0.7, 0)),
    comp("fissure-mound-right", "Mound fissure right", "micro", "detail", "box",
         "decal", "Glowing crack where the right shards meet the mound.",
         (0.42, 0.035, 0.05), (0.55, 0.62, 0.3), "fissure",
         importance=0.55, confidence=0.65, rot=(0, -0.6, 0)),
    comp("glow-pool", "Central glow pool", "meso", "detail", "box", "decal",
         "Light pooling in the hollow between the shards, brightest at the spire foot.",
         (0.5, 0.05, 0.5), (0, 0.62, 0.05), "fissure",
         importance=0.7, confidence=0.7, rot=(0, 0.4, 0)),
    # --- rubble ring, deterministic scatter, one entry each (no instancing to debug) ---
    comp("rubble-0", "Rubble 0", "micro", "detail", "box", "relief",
         "Loose basalt pebble.", (0.2, 0.12, 0.16), (1.25, 0.06, 0.35), "basalt",
         importance=0.3, confidence=0.7, rot=(0, 0.8, 0)),
    comp("rubble-1", "Rubble 1", "micro", "detail", "box", "relief",
         "Loose basalt pebble.", (0.16, 0.1, 0.15), (0.4, 0.05, 1.28), "basalt",
         importance=0.3, confidence=0.7, rot=(0, 2.2, 0)),
    comp("rubble-2", "Rubble 2", "micro", "detail", "box", "relief",
         "Loose basalt pebble.", (0.18, 0.11, 0.14), (-1.15, 0.05, 0.7), "basalt",
         importance=0.3, confidence=0.7, rot=(0, 4.0, 0)),
    comp("rubble-3", "Rubble 3", "micro", "detail", "box", "relief",
         "Loose basalt pebble.", (0.15, 0.09, 0.15), (-1.0, 0.045, -0.75), "basalt",
         importance=0.3, confidence=0.7, rot=(0, 1.5, 0)),
    comp("rubble-4", "Rubble 4", "micro", "detail", "box", "relief",
         "Loose basalt pebble.", (0.19, 0.12, 0.16), (0.35, 0.06, -1.25), "basalt",
         importance=0.3, confidence=0.7, rot=(0, 5.1, 0)),
    comp("rubble-5", "Rubble 5", "micro", "detail", "box", "relief",
         "Loose basalt pebble.", (0.14, 0.08, 0.13), (1.2, 0.04, -0.5), "basalt",
         importance=0.3, confidence=0.7, rot=(0, 3.0, 0)),
]

spec["componentTree"] = tree

spec["materials"] = [
    material("basalt", "Dark basalt rock", "#1a2129", ["#12171d", "#2b333c"],
             ["#1a2129", "#12171d", "#2b333c"], 0.9, 0.0, 0.5, flat=True,
             notes="Rough dielectric; almost no specular beyond the key highlight."),
    material("crystal", "Crystal faces", "#2a3542", ["#1c242e", "#4d5a68"],
             ["#2a3542", "#1c242e", "#4d5a68"], 0.42, 0.15, 0.8, flat=True,
             notes="Dark slate faces; lit rims come from the key, not from albedo. "
                   "Faceting is flatShading, not a normal map."),
    material("fissure", "Fissure glow", "#0d2531", ["#081820", "#1a9ec4"],
             ["#0d2531", "#081820", "#1a9ec4"], 0.4, 0.0, 0.0,
             emissive={"color": "#3fd8f5", "intensity": 1.6, "bloom": True,
                       "actsAsLightSource": False,
                       "notes": "Thin cracks only; hue verified live against the Core "
                                "Keep strips at the same intensity."},
             notes="De-lit base near-black; all hue is emission."),
]

spec["repetitionSystems"] = [
    {"id": "shard-ring", "name": "shard ring", "level": "meso", "parent": "root",
     "elementComponentIds": ["shard-spire", "shard-left", "shard-right",
                             "shard-back-left", "shard-back-right",
                             "shard-front-left", "shard-front-right"],
     "count": 7, "primitive": "lathe", "material": "crystal",
     "instanceScale": [0.5, 1.0, 0.5],
     "placement": {"mode": "radial", "axis": [0, 1, 0], "radius": 1.2,
                   "startAngleDeg": 0},
     "confidence": 0.7,
     "notes": "Documents the ring order; members are realised individually with "
              "per-shard tilt, so the system emits nothing."},
    {"id": "rubble-ring", "name": "rubble ring", "level": "micro", "parent": "root",
     "elementComponentIds": ["rubble-0", "rubble-1", "rubble-2", "rubble-3",
                             "rubble-4", "rubble-5"],
     "count": 6, "primitive": "box", "material": "basalt",
     "instanceScale": [0.17, 0.1, 0.15],
     "placement": {"mode": "radial", "axis": [0, 1, 0], "radius": 2.4,
                   "startAngleDeg": 20},
     "confidence": 0.7,
     "notes": "Documents the scatter; members realised individually."},
]

spec["suitability"] = "conditional"
spec["qualityTargets"] = {**spec.get("qualityTargets", {}),
    "targetFidelity": 0.7,
    "mustMatch": ["a cluster of dark faceted shards, tallest at centre-back",
                  "thin cyan fissures between shards, brightest up the spire",
                  "a low dark rock mound with scattered pebbles",
                  "no glowing faces: only cracks emit"],
    "niceToHave": ["exact shard count and lean angles",
                   "fissure branching detail"],
    "reviewViewpoints": ["three-quarter-front", "front", "right-side"]}

spec["featureReviewTargets"] = [
    {"id": "shard-cluster", "name": "Faceted shard cluster silhouette",
     "tier": "critical", "passIds": ["blockout", "structural-pass"], "minimumScore": 0.8,
     "mustPass": True, "componentRefs": ["shard-spire", "shard-left", "shard-right",
                                         "rock-mound"], "evidenceRefs": ["full-object"]},
    {"id": "fissure-layout", "name": "Cyan fissures read as cracks, not faces",
     "tier": "critical", "passIds": ["material-pass"], "minimumScore": 0.8,
     "mustPass": True, "componentRefs": ["fissure-spire", "glow-pool"],
     "evidenceRefs": ["full-object"]},
    {"id": "dark-crystal", "name": "Crystal faces dark slate, not glowing blue",
     "tier": "critical", "passIds": ["material-pass"], "minimumScore": 0.78,
     "mustPass": True, "componentRefs": ["shard-spire", "shard-left"],
     "evidenceRefs": ["full-object"]},
]

spec["coordinateFrame"] = {
    "front": "+Z, the two low stubs face the camera in the reference",
    "up": "+Y, the spire axis",
    "scaleReference": "mound width = 2.4 object units",
}
spec["assumptions"] = [
    "Shard count (7) and lean angles are plausible, not counted: the reference merges "
    "faces at 153 px and the rear is occluded.",
    "The rear two shards are generated by symmetry, not observed.",
    "Fissures are straight thin boxes; the reference suggests slight branching that a "
    "156 px-class crop cannot resolve into geometry.",
]
spec["risks"] = [
    {"id": "lathe-faceting", "severity": "medium",
     "risk": "If latheProfile.segments is ignored, shards render smooth and the cluster "
             "reads as blobs again.",
     "mitigation": "blockout flat capture: faceting is visible in silhouette even unlit."},
]

di = json.loads(DI.read_text())
spec["preSpecAssessment"]["detailInventory"] = di["detailInventory"]
spec["preSpecAssessment"]["unknownsToResolveBeforeImplementation"] = []

for build_pass in spec["buildPasses"]:
    build_pass["componentRefs"] = [c["id"] for c in tree]

if SPEC.exists():
    previous = json.loads(SPEC.read_text())
    for carried in ("reviewHistory", "sculptPipeline", "visualEvidence"):
        if previous.get(carried):
            spec[carried] = previous[carried]

SPEC.write_text(json.dumps(spec, indent=2) + "\n")
print(f"authored {len(tree)} components, {len(spec['materials'])} materials, "
      f"{len(spec['repetitionSystems'])} repetition systems")
