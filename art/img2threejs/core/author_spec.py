#!/usr/bin/env python3
"""Author the Core Keep sculpt spec on top of the scaffold `new_sculpt_spec.py` produced.

Kept as a script rather than hand-edited JSON so a `refine-spec` iteration re-runs it and the
reconstruction decisions live in one readable place instead of a 4000-line diff.
"""
import copy, json, math, random, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
# The pristine `new_sculpt_spec.py` output. Authoring reads the scaffold and writes the spec, so
# re-running this script is idempotent instead of layering itself onto its own output.
SCAFFOLD = HERE / "scaffold.json"
SPEC = HERE / "object-sculpt-spec.json"
DI = HERE / "di.json"
REF = "/Users/steve/Spix3l/age-of-agents/art/models/core.png"

RING_NOTES = {
    "buttress-foot": "Order 6, read from the plinth's visible corner angles; the rear three are "
                     "inferred, not observed.",
    "plinth-fascia": "One band per plinth face; three are visible, the rest follow the hexagon.",
    "lower-pod": "Four pods are visible; the count follows the plinth's 6-fold order.",
    "drum-fin": "Offset half a step from the pod ring so a fin sits above each pod gap.",
    "crown-collar-plate": "Read as 8 from the visible arc; a top-down view would settle it.",
}

spec = json.loads(SCAFFOLD.read_text())
template = copy.deepcopy(spec["componentTree"][0])
mat_template = copy.deepcopy(spec["materials"][0])

# --- observed palette (sampled from the crop, lighting removed by eye) ----------------------
# Reference is TWO-TONE: dominant white/light-grey armour panels over dark charcoal structure,
# with cyan emissive accents, small amber markers, and dark octagonal plinth. The first
# authorings read the small 156 px crop as all-dark steel; the high-res reference (user
# supplied) corrects that. Steel here is the structural dark, not the whole machine.
STEEL   = "rgba(35, 40, 46, 1.0)"
STEEL_D = "rgba(18, 23, 28, 1.0)"
WHITE   = "rgba(196, 202, 208, 1.0)"
WHITE_D = "rgba(148, 156, 164, 1.0)"
SILVER  = "rgba(141, 144, 150, 1.0)"
SILVER_D= "rgba(77, 88, 96, 1.0)"
GLASS   = "rgba(16, 22, 27, 1.0)"
CYAN    = "rgba(63, 216, 245, 1.0)"
CYAN_D  = "rgba(26, 158, 196, 1.0)"
AMBER   = "rgba(245, 161, 43, 1.0)"
# A self-lit strip's ALBEDO is not its glow. The reference's emissive runs sit on near-black
# plating and the hue comes from emission; painting the albedo full-bright double-counts it, which
# is what the material-pass colour gate caught at delta-E 68. These are the de-lit base colours,
# consistent with the extracted palettes for the same crops (#12222F for the cyan strip, #26221D
# for the amber bar); the hue moves to material.emissive.
CYAN_BASE  = "rgba(18, 50, 64, 1.0)"
AMBER_BASE = "rgba(58, 42, 18, 1.0)"
AMBER_D = "rgba(184, 112, 24, 1.0)"


def recipe(dominant, secondary, cls, conf, stops=None, gtype="linear"):
    out = {"dominantAlbedo": dominant, "secondaryAlbedo": secondary,
           "materialClass": cls, "materialClassConfidence": conf,
           "evidenceRefs": ["full-object"]}
    if stops:
        out["colorGradient"] = {"type": gtype,
                                "stops": [{"position": p, "color": c} for p, c in stops]}
    return out


def attach(parent, socket, start, end, contact, embed, gap, normal=(0, 1, 0)):
    return {"parentId": parent, "parentSocket": socket, "localStart": list(start),
            "localEnd": list(end), "contactType": contact, "embedDepth": embed,
            "gapTolerance": gap, "contactNormal": list(normal),
            "evidenceRefs": ["full-object"]}


def comp(cid, name, level, role, primitive, topo, rationale, dims, pos, material,
         parent="root", attachment=None, importance=0.6, confidence=0.75, rec=None,
         features=None, details=None, geometry=None, action=None, layers=None,
         rot=(0, 0, 0), scale=(1, 1, 1), evidence=None, surface=None):
    c = copy.deepcopy(template)
    c.update(id=cid, name=name, level=level, role=role, primitive=primitive,
             topologyClass=topo, topologyRationale=rationale, parent=parent,
             importance=importance, confidence=confidence, material=material,
             materialLayers=layers or [material],
             evidenceRefs=evidence or ["full-object"],
             details=details or [], localFeatures=features or [],
             attachment=attachment)
    c["dimensions"] = {"width": dims[0], "height": dims[1], "depth": dims[2],
                       "units": "relative", "confidence": confidence}
    # `scale_vector` short-circuits on `transform.scale` if the key is present AT ALL, so an
    # identity scale silently discards `dimensions` and every mesh renders as a unit primitive.
    # The key is therefore omitted unless a component really is non-uniformly scaled.
    c["transform"] = {"position": list(pos), "rotation": list(rot)}
    if tuple(scale) != (1, 1, 1):
        c["transform"]["scale"] = list(scale)
    c["colorMaterialRecipe"] = rec
    if geometry:
        c["geometryDescriptor"] = {**c["geometryDescriptor"], **geometry}
    if action:
        c["actionProfile"] = {**c["actionProfile"], **action}
    if surface:
        c["surfaceDetail"] = {**c["surfaceDetail"], **surface}
    return c


def geo(topology, bevel=0.0, segments=1, edge="none", **extra):
    d = {"topologyIntent": topology,
         "edgeTreatment": {"type": edge, "bevelRadius": bevel, "segments": segments}}
    d.update(extra)
    return d


def action(role, pivot_mode="center", pivot_pos=(0, 0, 0), axis=(0, 1, 0),
           fracture="root", breakable=False, impulse=0.0, sockets=None,
           collider=("box", (0, 0, 0), (1, 1, 1)), channels=None, fragments=None, seams=None):
    ap = {"animationRole": role,
          "pivot": {"mode": pivot_mode, "localPosition": list(pivot_pos),
                    "axis": list(axis), "confidence": 0.8},
          "sockets": sockets or [],
          "collider": {"type": collider[0], "offset": list(collider[1]),
                       "scale": list(collider[2]), "isTrigger": False,
                       "notes": "Convex proxy sized to the component's own bounds."},
          "constraints": [],
          "destruction": {"breakable": breakable, "fractureGroup": fracture,
                          "seamRefs": seams or [], "detachableFragments": fragments or [],
                          "breakImpulse": impulse, "debrisMaterial": "steel-dark"}}
    if channels:
        ap["transformChannels"] = {**copy.deepcopy(template["actionProfile"]["transformChannels"]),
                                   **channels}
    return ap


# ================================ component tree =============================================
# Object frame: Y up, +Z toward the reference camera. The base plinth is 2.0 wide (radius 1.0)
# and the structure stands 1.42 tall excluding the beam, matching the reference's 0.75 ratio.
#
# Three contracts of the factory generator drive the shapes below, all learned from the blockout
# review rather than assumed:
#   * `geometryDescriptor.radialSegments` is not read. A hexagonal tier is a `lathe` whose
#     `latheProfile.segments` is 6 -- which also gets the rim chamfer for free, as a profile step.
#   * A lathe profile is authored in UNIT space (radius <= 0.5, y in -0.5..0.5); the component's
#     `dimensions` are then baked into the vertex data.
#   * `transform.position` is the pivot Group's PARENT-LOCAL position, and `cylinder`/`cone`/
#     `capsule`/`tube` are attachment primitives whose position comes from `attachment.localStart`
#     instead. Only the beam wants that behaviour, so only the beam stays a cylinder.

# World heights of each tier, kept in one place because every parent-local offset below is derived
# from them rather than typed twice. The numbers come from measuring the reference's own silhouette
# row by row (`art/img2threejs/core/silhouette-profile.txt`), not from eyeballing the crop: the body
# is 118 px tall against a 145 px widest span, so with a 2.0-wide plinth it stands 1.63 tall, and
# the tier boundaries sit where the measured width steps.
BODY_H = 1.38
PLINTH_H, RING_H, DRUM_H, COLLAR_H = 0.22, 0.40, 0.42, 0.34
PLINTH_Y = PLINTH_H / 2
RING_Y = PLINTH_H + RING_H / 2
DRUM_Y = PLINTH_H + RING_H + DRUM_H / 2
COLLAR_Y = PLINTH_H + RING_H + DRUM_H + COLLAR_H / 2
BASIN_Y = PLINTH_H + RING_H + DRUM_H + COLLAR_H - 0.13
APERTURE_Y = BASIN_Y + 0.05
# The beam runs from the aperture to just past the top of the crop: 72 px of beam against 118 px
# of body.
BEAM_H = 0.99


def lathe(points, segments):
    return {"latheProfile": {"points": points, "segments": segments}}


# `root` is a pivot node, not a surface. The validator requires it (every tier names it as parent)
# but the generator has no way to say "this component emits no mesh", so its geometry is a
# degenerate 1mm stub: with dimensions honoured, a root sized to the object's real bounds emits a
# 2.0 x 1.63 x 2.0 box that the whole keep sits inside. The real extent lives on its collider,
# which is what physics and framing read.
root = copy.deepcopy(template)
root.update(id="root", name="Core Keep", level="macro", role="body", primitive="box",
            topologyClass="assembled-solid",
            topologyRationale=("Six hard-surface tiers joined at flat seams with no shared "
                               "continuous surface: each tier can be built, moved and destroyed "
                               "independently of the one below it."),
            importance=1.0, confidence=0.9, material="steel-dark",
            materialLayers=["steel-dark"], evidenceRefs=["full-object"])
root["dimensions"] = {"width": 0.001, "height": 0.001, "depth": 0.001, "units": "relative",
                      "confidence": 0.85}
root["transform"] = {"position": [0, 0, 0], "rotation": [0, 0, 0]}
root["colorMaterialRecipe"] = recipe(STEEL, SILVER, "metal", 0.9,
                                     [(0.0, STEEL_D), (0.6, STEEL), (1.0, SILVER)])
root["actionProfile"] = action("root", "base", (0, 0, 0), fracture="core-keep",
                               collider=("box", (0, BODY_H / 2, 0), (2.0, BODY_H, 2.0)))

tree = [root]

# --- macro 1: base plinth -------------------------------------------------------------------
tree.append(comp(
    "base-plinth", "Base plinth", "macro", "base", "lathe", "assembled-solid",
    ("A low octagonal slab with a single chamfered rim: an 8-sided lathe of revolution, not a "
     "sculpted volume, carrying every other tier on a flat load-bearing top face. Dark "
     "charcoal in the reference, contrasting the white armour above."),
    (2.6, PLINTH_H, 2.6), (0, PLINTH_Y, 0), "steel-dark",
    attachment=attach("root", "ground-plane", (0, 0, 0), (0, PLINTH_H, 0), "butt", 0.004, 0.002),
    importance=0.9, confidence=0.88,
    rec=recipe(STEEL, WHITE, "metal", 0.9, [(0.0, STEEL_D), (1.0, STEEL)]),
    geometry=geo("8-sided prism whose top rim chamfer is a profile step, not a bevel modifier",
                 0.06, 2, "chamfer",
                 **lathe([[0.001, -0.5], [0.5, -0.5], [0.5, 0.02], [0.43, 0.5], [0.001, 0.5]], 8)),
    features=[
        {"id": "base-plinth/rim-chamfer", "kind": "bevel",
         "description": "Wide chamfer around the whole hexagonal top rim, the widest bevel on "
                        "the model; reads as a continuous bright band under the key light.",
         "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.06, "segments": 2},
         "detailRefs": ["plinth-rim-chamfer"], "confidence": 0.9},
        {"id": "base-plinth/corner-bolt-ring", "kind": "fastener",
         "description": "One amber-lit hemispherical boss per hexagon vertex, raised, not "
                        "countersunk.",
         "instancing": {"type": "InstancedMesh", "count": 8, "distribution": "radial",
                        "radius": 1.02, "headShape": "hemisphere", "headRadius": 0.045,
                        "material": "emissive-amber"},
         "detailRefs": ["plinth-corner-bolts"], "confidence": 0.7},
        {"id": "base-plinth/rubble-scatter", "kind": "chip",
         "description": "Loose grey gravel on the plinth top in front of the keep; it breaks the "
                        "tier-joint silhouette, so it is geometry rather than a texture patch.",
         "instancing": {"type": "InstancedMesh", "count": 18, "distribution": "seeded-scatter",
                        "seed": 20260903, "pieceRadius": [0.012, 0.034],
                        "region": "front arc, radius 0.55-0.95"},
         "detailRefs": ["plinth-rubble"], "confidence": 0.65},
    ],
    details=["plinth-rim-chamfer", "plinth-corner-bolts", "plinth-rubble"],
    action=action("static", "base", (0, -PLINTH_H / 2, 0), fracture="tier-0", breakable=True,
                  impulse=14.0, collider=("cylinder", (0, 0, 0), (2.6, PLINTH_H, 2.6)),
                  seams=["plinth-to-ring"]),
    surface={"macroRoughness": 0.55, "microRoughness": 0.42, "bumpAmplitude": 0.01,
             "normalPattern": "fine brushed-steel grain aligned with each hexagon face",
             "occlusionPattern": "AO deepening into the rim chamfer and the tier seam",
             "edgeWearPattern": "none - the asset is factory-clean",
             "notes": "No dirt, rust or scratches anywhere in the reference."}))

tree.append(comp(
    "entry-ramp", "Front entry ramp", "meso", "aperture", "extrude", "assembled-solid",
    ("A stepped wedge recessed into one plinth face: an extruded stair profile, an assembled "
     "solid seated in a rebate rather than a continuous surface."),
    (0.48, 0.26, 0.40), (0, -0.02, 1.08), "steel-dark", parent="base-plinth",
    attachment=attach("base-plinth", "front-face-rebate", (0, 0, 0), (0, 0, 0.34),
                      "socket", 0.06, 0.002, (0, 0, 1)),
    importance=0.45, confidence=0.6,
    rec=recipe(STEEL_D, CYAN, "metal", 0.75, [(0.0, STEEL_D), (1.0, CYAN_D)]),
    geometry=geo("extruded 4-step stair profile", 0.01, 1, "chamfer",
                 profile2D={"points": [[-0.5, -0.5], [0.5, -0.5], [0.5, -0.25], [0.25, -0.25],
                                       [0.25, 0.0], [0.0, 0.0], [0.0, 0.25], [-0.25, 0.25],
                                       [-0.25, 0.5], [-0.5, 0.5]],
                            "depth": 0.6}),
    features=[{"id": "entry-ramp/tread-strips", "kind": "emissive",
               "description": "A cyan strip across each tread, stepping down toward the viewer.",
               "emissive": {"color": "#3fd8f5", "intensity": 1.6, "bloom": True},
               "instancing": {"type": "InstancedMesh", "count": 4, "distribution": "linear"},
               "detailRefs": ["ramp-treads"], "confidence": 0.7}],
    details=["ramp-treads"],
    action=action("static", "base", fracture="tier-0",
                  collider=("box", (0, 0, 0), (0.44, 0.26, 0.36)))))

# --- the four radial rings ------------------------------------------------------------------
# Authored member by member rather than as one template plus an instancing system. The generator's
# repetition emitter builds a UNIT primitive at a uniform scale, which cannot carry a pod's cap
# plate or a collar plate's lean; and its own rule is that a system whose members are all realised
# is documentation, not an instruction. So the rings below are real components and the
# repetitionSystems entries declare them, which is what keeps the two descriptions in step.
RINGS = [
    {"id": "buttress-foot", "name": "Buttress foot", "count": 8, "radius": 1.08,
     "start": 22.5, "parent": "base-plinth", "local_y": -0.01, "tilt": 0.0,
     "dims": (0.38, 0.24, 0.28), "material": "armour-white", "role": "support",
     "importance": 0.6, "confidence": 0.75, "fracture": "tier-0", "impulse": 6.0,
     "rec": recipe(WHITE, STEEL, "metal", 0.88, [(0.0, STEEL_D), (0.8, WHITE_D), (1.0, WHITE)]),
     "topology": ("A discrete chamfered block butted against the plinth, sharing no surface with "
                  "it; one of eight identical members of a radial system."),
     "intent": "chamfered white armour block", "bevel": (0.03, 3),
     "features": [], "details": [],
     "emissive": {"suffix": "lamp", "material": "emissive-amber", "hex": AMBER, "base": AMBER_BASE,
                  "dims": (0.16, 0.03, 0.02), "offset": (0, 0.02, 0.12),
                  "kind": "A slim amber marker on the foot's outward face."},
     "cap": {"dims": (0.42, 0.07, 0.30), "material": "armour-white",
             "rec": recipe(WHITE, WHITE_D, "metal", 0.9, [(0.0, WHITE_D), (1.0, WHITE)])}},
    {"id": "plinth-fascia", "name": "Plinth fascia band", "count": 8, "radius": 1.24,
     "start": 22.5, "parent": "base-plinth", "local_y": -0.015, "tilt": 0.0,
     "dims": (0.70, 0.07, 0.04), "material": "steel-dark", "role": "trim",
     "importance": 0.65, "confidence": 0.8, "fracture": "tier-0", "impulse": 2.0,
     "rec": recipe(STEEL_D, AMBER, "metal", 0.85, [(0.0, STEEL_D), (1.0, AMBER)]),
     "topology": ("Relief cut into the plinth's own face rather than an independent volume: a "
                  "shallow recessed band carrying one emissive bar."),
     "intent": "recessed band with an emissive floor", "bevel": (0.008, 1),
     "level": "meso", "topologyClass": "surface-relief",
     "features": [{"id": "base-plinth/fascia-bar", "kind": "emissive",
                    "description": "One amber horizontal bar per plinth face, the only warm hue on "
                                   "the lower structure and the widest emissive run on the model.",
                    "emissive": {"color": "#f5a12b", "intensity": 1.5, "bloom": True},
                    "detailRefs": ["pylon-amber-bars"], "confidence": 0.8}],
     "details": ["pylon-amber-bars"],
     "emissive": {"suffix": "bar", "material": "emissive-amber", "hex": AMBER, "base": AMBER_BASE,
                  "dims": (0.62, 0.035, 0.02), "offset": (0, 0.0, 0.025),
                  "kind": "The amber fascia bar itself, one per plinth face."}},
    {"id": "lower-pod", "name": "Lower armour pod", "count": 8, "radius": 0.98,
     "start": 22.5, "parent": "lower-armour-ring", "local_y": 0.02, "tilt": 0.0,
     "dims": (0.58, 0.28, 0.44), "material": "armour-white", "role": "armour",
     "importance": 0.8, "confidence": 0.8, "fracture": "tier-1", "impulse": 8.0,
     "rec": recipe(WHITE, STEEL, "metal", 0.88, [(0.0, STEEL_D), (0.75, WHITE_D), (1.0, WHITE)]),
     "topology": ("A closed solid socketed into the ring and leaning outward, with its own cap "
                  "plate as a separate child; one of eight identical members."),
     "intent": "chamfered white armour block leaning 8 degrees outward", "bevel": (0.04, 3),
     "detach": True,
     "features": [
         {"id": "lower-pod/screen-recess", "kind": "hole",
          "description": "A dark inset screen on the pod's outward face, set below the "
                         "surrounding plate with its own dark gloss interior.",
          "geometryEffect": {"type": "socket", "depth": 0.03, "width": 0.22, "height": 0.10,
                             "interiorMaterial": "steel-dark",
                             "materialOverrideRef": "steel-dark/panel-gloss-inset"},
          "detailRefs": ["pod-screen-recess"], "confidence": 0.75},
         {"id": "lower-pod/light-slot", "kind": "groove",
          "description": "A vertical cyan-lit channel recessed into the pod's lateral face, "
                         "with AO darkening at the channel mouth.",
          "geometryEffect": {"type": "groove", "width": 0.02, "depth": 0.02,
                             "path": "vertical, lateral face",
                             "floorMaterial": "emissive-cyan"},
          "detailRefs": ["pod-light-slot"], "confidence": 0.8}],
     "details": ["pod-screen-recess", "pod-light-slot", "cap-plate-gloss"],
     "emissive": {"suffix": "slot", "material": "emissive-cyan", "hex": CYAN, "base": CYAN_BASE,
                  "dims": (0.08, 0.22, 0.02), "offset": (0.15, -0.01, 0.175),
                  "kind": "The cyan light slot recessed into the pod's outward face."},
     "emissive2": {"suffix": "louver", "material": "emissive-cyan", "hex": CYAN,
                   "base": CYAN_BASE,
                   "dims": (0.32, 0.05, 0.02), "offset": (-0.04, 0.08, 0.215),
                   "kind": "A horizontal cyan louvre above the pod's screen recess."},
     "cap": {"dims": (0.60, 0.08, 0.46), "material": "armour-white",
             "rec": recipe(WHITE, WHITE_D, "metal", 0.9, [(0.0, WHITE_D), (1.0, WHITE)])}},
    {"id": "drum-fin", "name": "Drum vent fin", "count": 8, "radius": 0.72,
     "start": 0.0, "parent": "mid-drum", "local_y": 0.0, "tilt": 0.0,
     "dims": (0.30, 0.28, 0.20), "material": "steel-dark", "role": "vent",
     "importance": 0.6, "confidence": 0.7, "fracture": "tier-2", "impulse": 5.0,
     "rec": recipe(STEEL, CYAN, "metal", 0.85, [(0.0, STEEL_D), (0.85, STEEL), (1.0, CYAN)]),
     "topology": ("A flat-faced wedge butted against one drum face, not a swept surface; one of "
                  "eight identical members offset half a step from the pod ring."),
     "intent": "dark louvre wedge with a cyan bar", "bevel": (0.025, 2),
     "features": [], "details": ["tier-seam-ao"],
     "emissive": {"suffix": "bar", "material": "emissive-cyan", "hex": CYAN, "base": CYAN_BASE,
                  "dims": (0.20, 0.03, 0.02), "offset": (0, -0.06, 0.11),
                  "kind": "The cyan bar across the fin's outward face."}},
    {"id": "crown-collar-plate", "name": "Crown buttress pylon", "count": 8, "radius": 0.46,
     "start": 22.5, "parent": "crown-collar", "local_y": 0.02, "tilt": 0.22,
     # The reference crown is a ring of tall WHITE buttresses leaning inward around the glowing
     # basin -- the single strongest upper-body feature. Lean kept shallow so the glowing pool
     # between them stays visible from a 30-degree camera.
     "dims": (0.28, 0.50, 0.17), "material": "armour-white", "role": "armour",
     "importance": 0.85, "confidence": 0.75, "fracture": "tier-3", "impulse": 4.0,
     "rec": recipe(WHITE, CYAN, "metal", 0.88, [(0.0, WHITE_D), (0.75, WHITE), (1.0, CYAN)]),
     "topology": ("A chamfered solid wedge socketed into the collar rebate and leaning inward; "
                  "one of eight identical members."),
     "intent": "trapezoid plate leaning inward", "bevel": (0.03, 3), "detach": True,
     "features": [
         {"id": "crown-collar-plate/edge-chamfer", "kind": "bevel",
          "description": "A crisp bright line along the plate's top outer edge: a real chamfer "
                         "catching grazing key light, not a painted highlight.",
          "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.03, "segments": 3},
          "detailRefs": ["collar-plate-chamfer"], "confidence": 0.85},
         {"id": "crown-collar-plate/inlay-strip", "kind": "linework",
          "description": "A cyan strip inset into the plate's outward face, running with the "
                         "plate's lean; soft-edged glow with no relief.",
          "technique": "recessed emissive strip",
          "geometryEffect": {"type": "groove", "width": 0.018, "depth": 0.008,
                             "floorMaterial": "emissive-cyan"},
          "detailRefs": ["collar-inlay"], "confidence": 0.8}],
     "details": ["collar-plate-chamfer", "collar-inlay"],
     "emissive": {"suffix": "inlay", "material": "emissive-cyan", "hex": CYAN, "base": CYAN_BASE,
                  "dims": (0.14, 0.05, 0.02), "offset": (0, 0.0, 0.08),
                  "kind": "The cyan inlay strip inset into the plate's outward face."}},
]

ring_members: dict[str, list[str]] = {}
for ring in RINGS:
    members = []
    for index in range(ring["count"]):
        angle_deg = ring["start"] + index * 360.0 / ring["count"]
        angle = math.radians(angle_deg)
        member_id = f"{ring['id']}-{index}"
        members.append(member_id)
        tree.append(comp(
            member_id, f"{ring['name']} {index + 1}", ring.get("level", "meso"), ring["role"],
            "box", ring.get("topologyClass", "assembled-solid"), ring["topology"],
            ring["dims"],
            (ring["radius"] * math.sin(angle), ring["local_y"], ring["radius"] * math.cos(angle)),
            ring["material"], parent=ring["parent"],
            attachment=attach(ring["parent"], f"{ring['id']}-socket-{index}", (0, 0, 0),
                              (0, 0, ring["dims"][2]), "socket", 0.03, 0.002, (0, 0, 1)),
            importance=ring["importance"], confidence=ring["confidence"], rec=ring["rec"],
            geometry=geo(ring["intent"], ring["bevel"][0], ring["bevel"][1], "chamfer",
                         repetitionRef=f"{ring['id']}-ring", repetitionIndex=index),
            rot=(ring["tilt"], angle, 0),
            features=ring["features"] if index == 0 else [],
            details=ring["details"] if index == 0 else [],
            action=action("static", "center", fracture=ring["fracture"], breakable=True,
                          impulse=ring["impulse"],
                          collider=("box", (0, 0, 0), ring["dims"]),
                          channels={"detach": True} if ring.get("detach") else None)))
        for slot_key in ("emissive", "emissive2"):
            strip = ring.get(slot_key)
            if not strip:
                continue
            tree.append(comp(
                f"{member_id}-{strip['suffix']}", f"{ring['name']} {index + 1} {strip['suffix']}",
                "micro", "light", "box", "surface-relief",
                ("A self-lit strip lying in a shallow recess on its host's outward face: relief on "
                 "a host surface, with no volume of its own."),
                strip["dims"], strip["offset"], strip["material"], parent=member_id,
                attachment=attach(member_id, f"{ring['id']}-lightface", (0, 0, 0),
                                  (0, 0, strip["dims"][2]), "socket", 0.006, 0.001, (0, 0, 1)),
                importance=0.7, confidence=0.8,
                rec=recipe(strip["base"], strip["hex"], "glass", 0.75,
                           [(0.0, strip["base"]), (1.0, strip["hex"])]),
                geometry=geo(strip["kind"], 0.004, 1, "chamfer"),
                action=action("material-state", "center", fracture=ring["fracture"],
                              collider=("box", (0, 0, 0), strip["dims"]),
                              channels={"materialState": True})))
        if ring.get("cap"):
            cap = ring["cap"]
            tree.append(comp(
                f"{member_id}-cap", f"{ring['name']} {index + 1} cap plate", "micro", "trim",
                "box", "surface-relief",
                ("A polished plate crowning its host block and overhanging it slightly: relief "
                 "carried by the host surface, not an independent volume."),
                cap["dims"], (0, ring["dims"][1] / 2 + cap["dims"][1] / 2 - 0.008, 0.02),
                cap["material"], parent=member_id,
                attachment=attach(member_id, "pod-top-face", (0, 0, 0), (0, cap["dims"][1], 0),
                                  "overlap", 0.008, 0.001),
                importance=0.5, confidence=0.8, rec=cap["rec"],
                geometry=geo("thin chamfered plate", 0.012, 2, "chamfer"),
                details=["cap-plate-gloss"] if index == 0 else [],
                action=action("static", "center", fracture=ring["fracture"],
                              collider=("box", (0, 0, 0), cap["dims"])),
                surface={"macroRoughness": 0.18, "microRoughness": 0.14,
                         "normalPattern": "directional brushing along the plate's long axis",
                         "notes": "Anisotropic: the highlight stretches along the brushing "
                                  "direction."}))
    ring_members[ring["id"]] = members

# Seeded gravel on the plinth top, in the front arc where the reference shows it. Deterministic
# from a fixed seed so the scatter is identical in every build and in every review render.
_rubble = random.Random(20260903)
for rubble_index in range(14):
    _angle = math.radians(-70 + _rubble.random() * 140)
    _radius = 0.56 + _rubble.random() * 0.34
    _size = 0.024 + _rubble.random() * 0.042
    tree.append(comp(
        f"plinth-rubble-{rubble_index}", f"Plinth rubble {rubble_index + 1}", "micro", "debris",
        "box", "assembled-solid",
        ("A loose chip of plating lying on the plinth top: a discrete faceted solid resting on the "
         "surface, not relief carved into it."),
        (_size, _size * 0.6, _size * 0.85),
        (_radius * math.sin(_angle), PLINTH_H / 2 + _size * 0.3, _radius * math.cos(_angle)),
        "steel-dark", parent="base-plinth",
        attachment=attach("base-plinth", "plinth-top-face", (0, 0, 0), (0, _size * 0.6, 0),
                          "butt", 0.004, 0.001),
        importance=0.3, confidence=0.65,
        rec=recipe(STEEL, STEEL_D, "metal", 0.7, [(0.0, STEEL_D), (1.0, STEEL)]),
        geometry=geo("faceted chip", 0.006, 1, "chamfer"),
        rot=(_rubble.random() * 0.7, _rubble.random() * 6.28, _rubble.random() * 0.7),
        details=["plinth-rubble"] if rubble_index == 0 else [],
        action=action("static", "center", fracture="tier-0",
                      collider=("box", (0, 0, 0), (_size, _size * 0.6, _size * 0.85)))))

# --- macro 2: lower armour ring -------------------------------------------------------------
tree.append(comp(
    "lower-armour-ring", "Lower armour ring", "macro", "armour", "lathe", "assembled-solid",
    ("An octagonal drum that exists only as the mounting body for eight pods; hard flat "
     "faces meeting at edges, assembled rather than sculpted."),
    (1.90, RING_H, 1.90), (0, RING_Y, 0), "steel-dark",
    attachment=attach("root", "plinth-top-face", (0, PLINTH_H, 0), (0, PLINTH_H + RING_H, 0),
                      "butt", 0.02, 0.002),
    importance=0.85, confidence=0.85,
    rec=recipe(STEEL, SILVER, "metal", 0.9, [(0.0, STEEL_D), (1.0, STEEL)]),
    geometry=geo("8-sided prism, inset from the plinth", 0.03, 2, "chamfer",
                 **lathe([[0.001, -0.5], [0.5, -0.5], [0.5, 0.4], [0.45, 0.5], [0.001, 0.5]], 8)),
    action=action("static", "base", (0, -RING_H / 2, 0), fracture="tier-1", breakable=True,
                  impulse=12.0, collider=("cylinder", (0, 0, 0), (1.90, RING_H, 1.90)),
                  seams=["plinth-to-ring", "ring-to-drum"])))

# --- macro 3: mid tier drum -----------------------------------------------------------------
tree.append(comp(
    "mid-drum", "Mid tier drum", "macro", "housing", "lathe", "assembled-solid",
    ("The main machine housing: an octagonal prism, inset, whose faces carry the dark louvre "
     "fins and the front pylon as separately mounted solids. White armour faces in the "
     "reference with dark recessed seams."),
    (1.52, DRUM_H, 1.52), (0, DRUM_Y, 0), "armour-white",
    attachment=attach("root", "ring-top-face", (0, PLINTH_H + RING_H, 0),
                      (0, PLINTH_H + RING_H + DRUM_H, 0), "butt", 0.02, 0.002),
    importance=0.85, confidence=0.82,
    rec=recipe(WHITE, STEEL, "metal", 0.9, [(0.0, STEEL_D), (1.0, WHITE)]),
    geometry=geo("8-sided prism", 0.03, 2, "chamfer",
                 **lathe([[0.001, -0.5], [0.5, -0.5], [0.5, 0.4], [0.44, 0.5], [0.001, 0.5]], 8)),
    action=action("static", "base", (0, -DRUM_H / 2, 0), fracture="tier-2", breakable=True,
                  impulse=10.0, collider=("cylinder", (0, 0, 0), (1.52, DRUM_H, 1.52)),
                  seams=["ring-to-drum", "drum-to-collar"])))

tree.append(comp(
    "front-pylon", "Front pylon column", "meso", "housing", "box", "assembled-solid",
    ("A single stepped column standing proud of the drum's front face; a stack of flat-faced "
     "boxes, the one part of the model that breaks the radial repetition."),
    # The drum's octagon face plane sits at ~0.56 and the fin ring's outer faces reach ~0.72;
    # at z 0.62 the pylon merged into the fins and read as buried, while z 0.78 left it
    # floating. Deeper body (0.34) at z 0.68 stays socketed and stands proud of the fins.
    (0.36, 0.72, 0.40), (0, 0.02, 0.74), "armour-white", parent="mid-drum",
    attachment=attach("mid-drum", "drum-front-face", (0, 0, 0), (0, 0.52, 0),
                      "overlap", 0.04, 0.002, (0, 0, 1)),
    importance=0.75, confidence=0.75,
    rec=recipe(WHITE, AMBER, "metal", 0.88, [(0.0, WHITE_D), (0.7, WHITE), (1.0, AMBER)]),
    geometry=geo("three stacked boxes of decreasing depth", 0.02, 2, "chamfer"),
    action=action("static", "base", (0, -0.26, 0), fracture="tier-2", breakable=True,
                  impulse=4.0, collider=("box", (0, 0, 0), (0.32, 0.60, 0.22)))))

tree.append(comp(
    "pylon-head", "Pylon head panel", "micro", "panel", "box", "surface-relief",
    ("A recessed panel face carried on the pylon's front plane: relief on a host surface."),
    (0.26, 0.17, 0.03), (0, 0.16, 0.12), "steel-dark", parent="front-pylon",
    attachment=attach("front-pylon", "pylon-front-plane", (0, 0, 0), (0, 0, 0.03),
                      "socket", 0.015, 0.001, (0, 0, 1)),
    importance=0.5, confidence=0.6,
    rec=recipe(GLASS, AMBER, "metal", 0.7, [(0.0, GLASS), (1.0, AMBER_D)]),
    geometry=geo("recessed panel with a chamfered lip", 0.008, 1, "chamfer"),
    features=[{"id": "front-pylon/amber-bar-stack", "kind": "emissive",
               "description": "Two stacked amber horizontal bars below the panel, the only warm "
                              "hue on the upper structure, constant emission.",
               "emissive": {"color": "#f5a12b", "intensity": 1.4, "bloom": True},
               "instancing": {"type": "InstancedMesh", "count": 2, "distribution": "linear"},
               "detailRefs": ["pylon-amber-bars"], "confidence": 0.85}],
    details=["pylon-amber-bars", "pylon-status-panel"],
    action=action("material-state", "center", fracture="tier-2",
                  collider=("box", (0, 0, 0), (0.26, 0.17, 0.03)),
                  channels={"materialState": True})))

for bar_index, bar_y in enumerate((0.02, -0.05)):
    tree.append(comp(
        f"pylon-bar-{bar_index}", f"Pylon amber bar {bar_index + 1}", "micro", "light", "box",
        "surface-relief",
        ("A self-lit bar in a shallow recess on the pylon head: relief on a host surface."),
        (0.20, 0.03, 0.02), (0, bar_y, 0.03), "emissive-amber", parent="pylon-head",
        attachment=attach("pylon-head", "pylon-panel-face", (0, 0, 0), (0, 0, 0.02),
                          "socket", 0.006, 0.001, (0, 0, 1)),
        importance=0.7, confidence=0.85,
        rec=recipe(AMBER_BASE, AMBER, "glass", 0.8, [(0.0, AMBER_BASE), (1.0, AMBER)]),
        geometry=geo("amber bar, one of a stack of two", 0.004, 1, "chamfer"),
        details=["pylon-amber-bars"] if bar_index == 0 else [],
        action=action("material-state", "center", fracture="tier-2",
                      collider=("box", (0, 0, 0), (0.20, 0.03, 0.02)),
                      channels={"materialState": True})))

for tread_index in range(4):
    tree.append(comp(
        f"ramp-tread-{tread_index}", f"Ramp tread strip {tread_index + 1}", "micro", "light",
        "box", "surface-relief",
        ("A self-lit strip across one ramp tread: relief on a host surface."),
        (0.30, 0.02, 0.05), (0, 0.09 - tread_index * 0.06, 0.02 + tread_index * 0.07),
        "emissive-cyan", parent="entry-ramp",
        attachment=attach("entry-ramp", f"ramp-tread-{tread_index}", (0, 0, 0), (0, 0.02, 0),
                          "overlap", 0.004, 0.001),
        importance=0.5, confidence=0.7,
        rec=recipe(CYAN_BASE, CYAN, "glass", 0.75, [(0.0, CYAN_BASE), (1.0, CYAN)]),
        geometry=geo("cyan tread strip", 0.003, 1, "chamfer"),
        details=["ramp-treads"] if tread_index == 0 else [],
        action=action("material-state", "center", fracture="tier-0",
                      collider=("box", (0, 0, 0), (0.30, 0.02, 0.05)),
                      channels={"materialState": True})))

# --- corner antenna masts -------------------------------------------------------------------
# The reference raises thin masts with cyan-lit tips at the plinth corners. Two components
# each (mast + tip), at four of the eight octagon vertices.
for mast_index, mast_angle in enumerate((0.0, math.pi / 2, math.pi, 3 * math.pi / 2)):
    mast_x, mast_z = 1.2 * math.sin(mast_angle), 1.2 * math.cos(mast_angle)
    tree.append(comp(
        f"antenna-mast-{mast_index}", f"Corner antenna mast {mast_index + 1}", "meso",
        "antenna", "box", "assembled-solid",
        ("A thin tapered mast at a plinth corner vertex; one of four."),
        (0.035, 0.68, 0.035), (mast_x, 0.13 + 0.34, mast_z), "steel-dark",
        parent="base-plinth",
        attachment=attach("base-plinth", f"antenna-socket-{mast_index}", (0, 0.11, 0),
                          (0, 0.66, 0), "butt", 0.004, 0.002),
        importance=0.55, confidence=0.75,
        rec=recipe(STEEL, CYAN, "metal", 0.8, [(0.0, STEEL_D), (1.0, STEEL)]),
        geometry=geo("thin tapered mast", 0.006, 1, "chamfer"),
        details=["corner-antennas"] if mast_index == 0 else [],
        action=action("static", "base", fracture="tier-0", breakable=True, impulse=1.0,
                      collider=("box", (0, 0, 0), (0.035, 0.55, 0.035)))))
    tree.append(comp(
        f"antenna-tip-{mast_index}", f"Antenna tip light {mast_index + 1}", "micro",
        "light", "box", "surface-relief",
        ("A self-lit cap on the mast top: relief on a host surface."),
        (0.055, 0.06, 0.055), (0, 0.305, 0), "emissive-cyan", parent=f"antenna-mast-{mast_index}",
        attachment=attach(f"antenna-mast-{mast_index}", "mast-top", (0, 0.275, 0),
                          (0, 0.335, 0), "butt", 0.002, 0.001),
        importance=0.6, confidence=0.8,
        rec=recipe(CYAN_BASE, CYAN, "glass", 0.8, [(0.0, CYAN_BASE), (1.0, CYAN)]),
        geometry=geo("cyan tip light", 0.004, 1, "chamfer"),
        details=["corner-antennas"] if mast_index == 0 else [],
        action=action("material-state", "center", fracture="tier-0",
                      collider=("box", (0, 0, 0), (0.055, 0.06, 0.055)),
                      channels={"materialState": True})))

# --- macro 4: crown collar ------------------------------------------------------------------
tree.append(comp(
    "crown-collar", "Crown collar", "macro", "armour", "lathe", "assembled-solid",
    ("A low open seat ring the eight plates stand on: the reference crown is the plates "
     "with visible gaps and the glowing basin between them, so the seat ends at an open "
     "rim instead of closing into a dome that fills every gap."),
    (1.30, COLLAR_H, 1.30), (0, COLLAR_Y, 0), "steel-dark",
    attachment=attach("root", "drum-top-rebate", (0, PLINTH_H + RING_H + DRUM_H, 0),
                      (0, PLINTH_H + RING_H + DRUM_H + COLLAR_H, 0), "socket", 0.04, 0.002),
    importance=0.9, confidence=0.75,
    rec=recipe(STEEL, CYAN, "metal", 0.88, [(0.0, STEEL_D), (0.8, STEEL), (1.0, CYAN)]),
    geometry=geo("open seat ring, 8 radial segments, rim left open for the basin",
                 0.03, 2, "chamfer",
                 **lathe([[0.001, -0.5], [0.5, -0.5], [0.44, 0.0], [0.36, 0.2],
                          [0.32, 0.26]], 8)),
    action=action("static", "base", (0, -COLLAR_H / 2, 0), fracture="tier-3", breakable=True,
                  impulse=9.0, collider=("cylinder", (0, 0, 0), (1.16, COLLAR_H, 1.16)),
                  seams=["drum-to-collar"])))

# --- macro 5: emitter basin -----------------------------------------------------------------
tree.append(comp(
    "emitter-basin", "Emitter basin", "macro", "aperture", "lathe", "assembled-solid",
    ("A concave dish inset in the collar; a shallow lathe of revolution whose interior is a "
     "visible cavity carrying the dark gloss inset override."),
    (0.72, 0.16, 0.72), (0, BASIN_Y, 0), "steel-dark",
    attachment=attach("root", "collar-inner-rebate", (0, BASIN_Y - 0.08, 0),
                      (0, BASIN_Y + 0.08, 0), "socket", 0.06, 0.002),
    importance=0.85, confidence=0.8,
    rec=recipe(GLASS, CYAN, "metal", 0.8, [(0.0, GLASS), (0.7, CYAN_D), (1.0, CYAN)], "radial"),
    geometry=geo("shallow concave dish, 8 radial segments: outer wall up, inner wall back down "
                 "to a recessed floor", 0.02, 2, "chamfer",
                 **lathe([[0.001, -0.30], [0.28, -0.30], [0.44, 0.10], [0.50, 0.5],
                          [0.42, 0.5], [0.22, 0.02], [0.001, -0.10]], 8)),
    action=action("static", "center", fracture="tier-3",
                  collider=("cylinder", (0, 0, 0), (0.72, 0.16, 0.72)))))

tree.append(comp(
    "crown-ring", "Crown emitter ring", "meso", "emitter", "torus", "assembled-solid",
    ("A torus lying flush in the basin floor: a closed ring solid, concentric with the aperture."),
    # The basin floor's top surface sits at about local y -0.01; the ring rides proud of the
    # floor and grew to fill the seat opening: in the reference the glowing pool is the
    # brightest non-beam element on the model.
    (0.52, 0.52, 0.07), (0, 0.05, 0), "emissive-cyan", parent="emitter-basin",
    attachment=attach("emitter-basin", "basin-floor", (0, 0, 0), (0, 0.05, 0),
                      "overlap", 0.012, 0.001),
    importance=0.9, confidence=0.9,
    # THREE.TorusGeometry lies in the XY plane, so a ring that lies FLAT in the basin needs a
    # quarter turn about X. The blockout shipped without it and the ring stood up beside the model.
    rot=(-math.pi / 2, 0, 0),
    rec=recipe(CYAN_BASE, CYAN, "metal", 0.85, [(0.0, CYAN_BASE), (1.0, CYAN)], "radial"),
    geometry=geo("torus, tube radius 0.025", 0.0, 1, "none", torusTubeRatio=0.11),
    details=["crown-ring"],
    action=action("material-state", "center", fracture="tier-3",
                  collider=("cylinder", (0, 0, 0), (0.52, 0.07, 0.52)),
                  channels={"materialState": True, "scale": True})))

# --- the glowing core dome ------------------------------------------------------------------
# The reference crown's centerpiece is a bright cyan dome sitting in the middle of the
# buttress ring, with the beam rising out of it. A thin torus alone read as a dark hole.
tree.append(comp(
    "core-dome", "Core emitter dome", "meso", "emitter", "sphere", "assembled-solid",
    ("A glowing hemisphere rising from the basin floor: the crown's light source, half-sunk "
     "so its silhouette is a dome."),
    (0.62, 0.46, 0.62), (0, 0.10, 0), "emissive-cyan", parent="emitter-basin",
    attachment=attach("emitter-basin", "basin-centre", (0, 0.02, 0), (0, 0.25, 0),
                      "overlap", 0.05, 0.002),
    importance=0.95, confidence=0.85,
    rec=recipe(CYAN_BASE, CYAN, "glass", 0.9, [(0.0, CYAN_BASE), (1.0, CYAN)], "radial"),
    geometry=geo("hemisphere: sphere half-sunk in the basin", 0.0, 1, "none"),
    details=["crown-ring"],
    action=action("material-state", "center", fracture="tier-3",
                  collider=("cylinder", (0, 0, 0), (0.62, 0.3, 0.62)),
                  channels={"materialState": True, "scale": True})))

# --- macro 6: beam --------------------------------------------------------------------------
# The one component that WANTS the attachment-primitive path: a cylinder whose length and
# position are derived from the aperture-to-tip endpoints rather than from a transform.
tree.append(comp(
    "beam-column", "Axial beam column", "macro", "effect", "cylinder", "material-only",
    ("Volumeless light. It has no surface in the reference and is reconstructed as additive "
     "emissive geometry whose appearance is entirely a material decision."),
    # The reference beam is a broad column whose base swells over the pool: a 0.20 core inside
    # a 0.42 halo shell approximates the radial falloff without a bloom pass.
    (0.17, BEAM_H, 0.17), (0, APERTURE_Y + BEAM_H / 2, 0), "beam-light",
    attachment=attach("root", "aperture-centre", (0, APERTURE_Y, 0),
                      (0, APERTURE_Y + BEAM_H, 0), "butt", 0.06, 0.004),
    importance=1.0, confidence=0.9,
    rec=recipe(CYAN_BASE, CYAN, "metal", 0.6,
               [(0.0, CYAN_BASE), (0.35, CYAN), (1.0, "rgba(26, 158, 196, 0.0)")]),
    geometry=geo("open-ended cylinder, additive, vertex alpha falling to 0 at the top",
                 0.0, 1, "none", openEnded=True, doubleSided=True),
    details=["beam-column"],
    action=action("pulse", "base", (0, -BEAM_H / 2, 0), fracture="none",
                  collider=("box", (0, 0, 0), (0.17, BEAM_H, 0.17)),
                  channels={"scale": True, "materialState": True, "visibility": True})))

tree.append(comp(
    "beam-halo", "Beam halo shell", "meso", "effect", "cylinder", "material-only",
    ("The soft outer column around the beam core. Also volumeless light: a second, wider and "
     "dimmer shell is the code-only stand-in for an additive falloff, since the generator emits "
     "no blend modes."),
    (0.36, BEAM_H * 0.92, 0.36), (0, APERTURE_Y + BEAM_H * 0.46, 0), "beam-halo",
    # Parented to root, not to the beam core: the core is an attachment primitive, so its pivot
    # sits at the aperture rather than at the origin, and a child positioned in world terms under
    # it lands a full aperture-height too high.
    attachment=attach("root", "aperture-centre", (0, APERTURE_Y, 0),
                      (0, APERTURE_Y + BEAM_H * 0.92, 0), "butt", 0.02, 0.004),
    importance=0.6, confidence=0.7,
    rec=recipe(CYAN_BASE, CYAN, "glass", 0.55,
               [(0.0, CYAN_BASE), (1.0, "rgba(26, 158, 196, 0.0)")]),
    geometry=geo("open-ended cylinder, wider and dimmer than the core", 0.0, 1, "none",
                 openEnded=True, doubleSided=True),
    details=["beam-column"],
    action=action("pulse", "base", (0, -BEAM_H * 0.46, 0), fracture="none",
                  collider=("box", (0, 0, 0), (0.36, BEAM_H * 0.92, 0.36)),
                  channels={"scale": True, "materialState": True, "visibility": True})))

spec["componentTree"] = tree

# ================================== materials ================================================
def material(mid, name, color, secondary, palette, rough, rough_var, metal, emissive=None,
             overrides=None, notes="", bands=None, normal=None, ao=None, mtype="standard",
             env=0.3, flat=True):
    m = copy.deepcopy(mat_template)
    m.update(id=mid, name=name, type=mtype, baseColor=color, color=color, notes=notes,
             localOverrides=overrides or [])
    # Per-material probe response, read live in the Model Lab (scene.environmentIntensity 0.15):
    # a shared 0.8 washed dark steel to mid grey while starving nothing else, so each material
    # carries its own weight. Dark metals sit low, trim/glass sit high enough to keep their
    # highlight, self-lit surfaces carry no probe at all. The factory generator reads this key
    # as `material.envMapIntensity`.
    m["envMapIntensity"] = env
    m["albedo"] = {"dominant": color, "secondary": secondary,
                   "samplingNotes": "Sampled per zone from the reference crop with the key-light "
                                    "highlight excluded, not averaged over the whole part."}
    m["colorVariation"] = {"palette": palette, "pattern": "panelled", "amplitude": 0.06,
                           "heightCorrelation": 0.2}
    m["roughness"] = {"base": rough, "variation": rough_var,
                      "map": "independent-procedural-field",
                      "localResponse": "roughness rises in the tier seams and falls on chamfered "
                                       "edges where the plating is polished by manufacture"}
    m["metalness"] = {"base": metal, "variation": 0.02}
    m["textureResolution"] = 1024
    # The keep is faceted hard-surface armour: the reference shows crisp per-face value steps
    # with no smeared highlights. Smooth-shaded lathes interpolated normals across profile
    # kinks and rendered the drum skirt and plinth top as melted gloss.
    m["flatShading"] = flat
    if bands:
        m["surfaceFrequencyBands"] = bands
    if normal:
        m["normal"] = {**m["normal"], **normal}
    if ao:
        m["ambientOcclusion"] = {**m["ambientOcclusion"], **ao}
    if emissive:
        # The factory generator reads `emissive` as a hex STRING and `emissiveIntensity` as a
        # number; handed the descriptive object this spec used to carry, it fell through to
        # '#000000' and every emissive surface rendered dead. The observation stays, one field
        # across, so nothing is lost from the record.
        m["emissive"] = emissive["color"]
        m["emissiveIntensity"] = emissive["intensity"]
        m["emissiveObservation"] = emissive
    m["wear"] = {**m["wear"], "edgeWearAmount": 0.0,
                 "notes": "The reference shows no edge wear; the asset is factory-clean."}
    m["dirt"] = {**m["dirt"], "amount": 0.0,
                 "notes": "No dirt or staining anywhere in the reference."}
    return m


BANDS = [
    {"id": "macro", "frequency": 1.5, "amplitude": 0.05,
     "role": "plate-to-plate value shift across the six faces"},
    {"id": "meso", "frequency": 9.0, "amplitude": 0.03,
     "role": "panel seams and the recessed screen lips"},
    {"id": "micro", "frequency": 48.0, "amplitude": 0.012,
     "role": "brushed-steel grain, visible only under grazing key light"},
]

# `extract_pbr_evidence.py` writes the reference-derived channel maps and a confidence per
# material. Its palettes read darker than the albedo values above because they still carry the
# reference's own key light; the hand-sampled albedo is the de-lit estimate, and the extraction is
# attached as the evidence of record rather than replacing it.
def attach_reference_pbr(mat):
    evidence = HERE / "pbr-evidence" / f"{mat['id']}.json"
    if not evidence.exists():
        return mat
    data = json.loads(evidence.read_text())
    # The extracted channel maps are copied into the source tree and wired as DEV-SERVER URLs
    # so the strict gate can see them: the extraction writes absolute filesystem paths, which
    # a browser TextureLoader can never fetch (it 404s and the material renders an empty black
    # map -- the wash-out that survived three material passes). They stay render-disabled (see
    # `usable` above); adoption into the production bundle needs bundle-aware imports and is a
    # recorded follow-up. scripts/copy-pbr-evidence.sh syncs the files.
    maps = {}
    for channel, entry in data.get("maps", {}).items():
        path = entry["path"] if isinstance(entry, dict) and "path" in entry else entry
        maps[channel] = {"path": f"/src/game/rendering/models/generated/evidence/core/"
                                 f"{mat['id']}_{channel}.png",
                         "extractedFrom": path}
    mat["referencePbr"] = {
        # The maps wired here are SYNTHESIZED clean tiling textures (scripts/make-pbr-canvases.py)
        # built from the authored palette below, which the extraction palettes ground. The raw
        # extractions (art/img2threejs/core/pbr-evidence, recorded under extractedFrom) are pixel
        # patches from a 156 px reference -- contaminated with background pixels and upscaled
        # into mush -- and verified unusable as tiling surfaces in a live render 2026-09-03.
        "usable": True,
        "confidence": data["confidence"],
        "sourceCrop": data["sourceImage"],
        "extractedPalette": data.get("palette", []),
        "maps": maps,
        "limitation": "Single-image inference, not inverse rendering: these channels are derived "
                      "from one 156 px crop and are evidence for the material's response, not a "
                      "measurement of it. The wired maps are synthesized from the authored "
                      "palette; raw extractions ride under extractedFrom. Dev-server URLs; "
                      "production adoption needs bundle-aware imports.",
    }
    return mat


spec["materials"] = [
    material("steel-dark", "Structural dark gunmetal", "#23282e", ["#181d22", "#2e353d"],
             ["#23282e", "#181d22", "#2e353d"], 0.6, 0.10, 0.30, bands=BANDS, env=0.5,
             normal={"pattern": "brushed grain aligned per face", "strength": 0.3, "scale": 30.0},
             ao={"intensity": 0.9, "cavityBias": 0.7} if isinstance(mat_template.get("ambientOcclusion"), dict) else None,
             notes="Structural recesses, plinth, seat rings and louvre housings. Panels shade "
                   "diffusely: coated metal, not raw metal.",
             overrides=[{"id": "steel-dark/tier-seam-ao", "kind": "seam",
                         "region": "every tier joint",
                         "aoDarkening": 0.45, "roughnessDelta": 0.1, "relief": "none",
                         "detailRefs": ["tier-seam-ao"],
                         "notes": "A soft dark line, not a hard groove; no measurable depth at "
                                  "156 px, so AO only."},
                        {"id": "steel-dark/panel-gloss-inset", "kind": "gloss",
                         "region": "recessed screen panels on the pods, the pylon head and the "
                                   "emitter basin floor",
                         "albedoMultiplier": 0.35, "roughness": 0.15, "metalness": 0.0,
                         "detailRefs": ["pod-screen-recess"],
                         "notes": "A single sharp highlight with no diffuse body: a dark "
                                  "dielectric inset. Carried as an override rather than its own "
                                  "material because no window in the 156 px reference isolates "
                                  "it from surrounding steel and shadow."},
                        {"id": "steel-dark/status-panel-decal", "kind": "decal",
                         "region": "pylon head panel",
                         "decal": {"source": "generated-canvas", "size": [0.14, 0.07],
                                   "rotation": 0.0,
                                   "content": "three short amber dashes and one pale square"},
                         "detailRefs": ["pylon-status-panel"],
                         "notes": "Flat against the surface, no thickness. Read at 1-2 px in the "
                                  "reference, so the layout is plausible, not measured."}]),
    material("armour-white", "White armour plating", "#c4cad0", ["#b7bdc4", "#dde2e6"],
             ["#c4cad0", "#b7bdc4", "#dde2e6"], 0.5, 0.10, 0.12, bands=BANDS, env=0.7,
             notes="The dominant read of the reference: white chamfered armour panels over dark "
                   "structure. Dielectric-coated, broad soft speculars."),
    # Metalness 0.85 made the caps depend almost entirely on the probe, and under a probe dimmed
    # to keep the plating dark they went dark with it -- so the brightest surfaces in the reference
    # became some of the dimmest in the render. Observation supports a lower value: the caps show a
    # light diffuse body under the key with a tight highlight riding on it, which is a coated or
    # anodised trim, not raw metal.
    material("trim-silver", "Polished silver trim", "#8d9096", ["#4d5860", "#b4b6b7"],
             ["#8d9096", "#4d5860", "#b4b6b7"], 0.22, 0.08, 0.35, bands=BANDS, env=1.6,
             normal={"pattern": "directional brushing along each plate's long axis",
                     "strength": 0.22, "scale": 40.0},
             notes="Anisotropic response: the highlight stretches along the brushing direction.",
             overrides=[{"id": "trim-silver/cap-gloss", "kind": "gloss",
                         "region": "pod and buttress cap plates",
                         "roughness": 0.18, "anisotropy": 0.6, "anisotropyRotation": 0.0,
                         "detailRefs": ["cap-plate-gloss"],
                         "notes": "Hotspot sits on the plate crown, matching a key light above "
                                  "and to the front-left."}]),
    material("emissive-cyan", "Cyan emissive", "#123240", ["#0d2531", "#1a9ec4"],
             ["#123240", "#0d2531", "#1a9ec4"], 0.35, 0.05, 0.0,
             # Intensity 3.2 clipped to white under ACES in the live lab; 1.6 holds the hue.
             emissive={"color": "#3fd8f5", "intensity": 1.6, "bloom": True,
                       "actsAsLightSource": True,
                       "notes": "The crown ring visibly spills onto the basin walls, so it needs "
                                "a matching point light, not emission alone."},
             bands=BANDS, env=0.0, notes="Self-lit, no shading gradient across the strip.",
             overrides=[{"id": "emissive-cyan/crown-ring", "kind": "emissive",
                         "region": "the torus lying in the basin floor",
                         "emissive": {"color": "#3fd8f5", "intensity": 1.6, "bloom": True},
                         "matchingLight": {"type": "point", "intensity": 1.2, "distance": 1.2},
                         "detailRefs": ["crown-ring"],
                         "notes": "Constant emission that reads as a real light source: the "
                                  "basin walls brighten toward it."}]),
    material("emissive-amber", "Amber emissive", "#3a2a12", ["#2a1e0d", "#b87018"],
             ["#3a2a12", "#2a1e0d", "#b87018"], 0.35, 0.05, 0.0,
             # Intensity 2.4 clipped toward white-yellow; 1.4 holds the amber hue.
             emissive={"color": "#f5a12b", "intensity": 1.4, "bloom": True,
                       "actsAsLightSource": False,
                       "notes": "Lower value than the cyan; no visible spill onto neighbours."},
             bands=BANDS, env=0.0, notes="Self-lit, constant, the only warm hue on the model."),
    material("beam-halo", "Beam halo shell", "#12303c", ["#0d2531", "#1a9ec4"],
             ["#12303c", "#0d2531", "#1a9ec4"], 0.0, 0.0, 0.0,
             emissive={"color": "#2ea6cc", "intensity": 0.9, "bloom": True,
                       "actsAsLightSource": False,
                       "notes": "Dimmer than the core by design: together the two shells "
                                "approximate the reference's radial falloff."},
             bands=BANDS, env=0.0,
             notes="The soft outer column. A representation, not an observed surface."),
    material("beam-light", "Beam light column", "#1a3f4d", ["#123240", "#3fd8f5"],
             ["#1a3f4d", "#123240", "#3fd8f5"], 0.0, 0.0, 0.0,
             # Intensity 4.0 rendered a white stick; 1.5 keeps the cyan body with a hot base.
             emissive={"color": "#7fe8ff", "intensity": 1.5, "bloom": True,
                       "actsAsLightSource": True,
                       "notes": "Additive blending, depth write off, vertex alpha falling to 0 at "
                                "the top so the column has no hard end."},
             bands=BANDS, env=0.0,
             notes="A representation of volumeless light, not an observed surface.",
             overrides=[{"id": "emissive-cyan/beam-column", "kind": "emissive",
                         "region": "the full height of the axial column",
                         "emissive": {"color": "#7fe8ff", "intensity": 1.5, "bloom": True},
                         "gradient": {"type": "linear", "axis": "y",
                                      "stops": [{"position": 0.0, "alpha": 1.0},
                                                {"position": 0.35, "alpha": 0.75},
                                                {"position": 1.0, "alpha": 0.0}]},
                         "detailRefs": ["beam-column"],
                         "notes": "Brightest at its base, falling to zero alpha at the top; no "
                                  "shading gradient across its width."}]),
]

# armour-white has no per-crop extraction (it comes from the high-res user reference, not the
# 156 px sheet cell), so it carries the same synthesized-map wiring the other materials get from
# attach_reference_pbr: palette-grounded canvases, gate-visible maps, provenance recorded.
for _m in spec["materials"]:
    if _m["id"] == "armour-white":
        _m["referencePbr"] = {
            "usable": True,
            "confidence": 0.8,
            "sourceCrop": "high-res user reference supplied in chat 2026-09-03 (save it to "
                          "art/reference/core-hd.png to make this provenance loadable)",
            "extractedPalette": ["#C4CAD0", "#B7BDC4", "#DDE2E6"],
            "maps": {channel: {"path": f"/src/game/rendering/models/generated/evidence/core/"
                                       f"armour-white_{channel}.png"}
                     for channel in ("albedo", "roughness", "height", "normal", "ao")},
            "limitation": "No pixel extraction was run for this material: the white armour read "
                          "comes from the high-res user reference. Maps are synthesized from the "
                          "authored palette (scripts/make-pbr-canvases.py); dev-server URLs.",
        }

spec["materials"] = [attach_reference_pbr(m) for m in spec["materials"]]

# =============================== repetition systems ==========================================
# Declared with elementComponentIds, which is what tells the generator these members are already
# built: the systems document the radial order for review and for any later re-authoring, and do
# not emit a second, cruder copy of each ring.
RING_BY_ID = {ring["id"]: ring for ring in RINGS}
spec["repetitionSystems"] = [
    {"id": f"{ring_id}-ring", "name": f"{RING_BY_ID[ring_id]['name']} ring",
     "level": RING_BY_ID[ring_id].get("level", "meso"),
     "parent": RING_BY_ID[ring_id]["parent"],
     "elementComponentIds": members,
     "count": len(members), "primitive": "box",
     "material": RING_BY_ID[ring_id]["material"],
     "instanceScale": list(RING_BY_ID[ring_id]["dims"]),
     "placement": {"mode": "radial", "axis": [0, 1, 0],
                   "radius": RING_BY_ID[ring_id]["radius"] * 2,
                   "startAngleDeg": RING_BY_ID[ring_id]["start"]},
     "confidence": RING_BY_ID[ring_id]["confidence"],
     "notes": RING_NOTES[ring_id]}
    for ring_id, members in ring_members.items()
]

# ================================= the rest ==================================================
spec["suitability"] = "conditional"
spec["scores"] = {"object_isolation": 3, "silhouette_readability": 3,
                  "depth_inference": 2, "primitive_decomposition": 3,
                  "material_procedurality": 3, "occlusion_risk": 2,
                  "interaction_fit": 3}
spec["preSpecAssessment"]["complexity"]["scores"] = {
    "silhouetteComplexity": 2, "componentCount": 2, "hierarchyDepth": 2,
    "repetitionDensity": 3, "materialLayerCount": 2, "localDetailDensity": 2,
    "occlusionRisk": 2, "actionReadinessNeed": 2}

spec["coordinateFrame"] = {
    "front": "+Z, the face carrying the entry ramp and the pylon (camera-facing in the reference)",
    "up": "+Y, the beam axis",
    "scaleReference": "base plinth width = 2.0 object units; body height excluding the beam = "
                      "1.63, from the reference's measured 118 px body against its 145 px widest "
                      "span (ratio 0.814)",
}

spec["silhouette"] = {
    "boundingShape": "truncated hexagonal frustum, wider at the base, with a thin axial column "
                     "rising from the apex",
    "aspectRatios": [{"id": "height-to-base-width", "value": 0.814},
                     {"id": "crown-width-to-base-width", "value": 0.55},
                     {"id": "beam-height-to-body-height", "value": 0.61}],
    "symmetry": "radial, order 6 (crown collar order 8); the front pylon and entry ramp are the "
                "only breaks in the repetition",
    "dominantCurves": ["the stepped outer profile from plinth to crown, three inward jumps",
                       "the inward lean of the collar plates closing toward the aperture"],
    "negativeSpaces": ["the gaps between adjacent lower pods",
                       "the concave basin between the collar rim and the aperture"],
    "landmarks": [{"id": "apex-aperture", "normalized": [0.5, 0.42]},
                  {"id": "collar-rim", "normalized": [0.5, 0.33]},
                  {"id": "plinth-rim", "normalized": [0.5, 0.86]}],
}

spec["viewEvidence"] = [{
    "id": "full-object", "view": "three-quarter-front",
    "imageRegion": {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0, "units": "normalized"},
    "observations": [
        "Three stepped tiers, none sharing a radius with another.",
        "Six-fold radial repetition on the plinth and lower ring; eight-fold on the crown collar.",
        "Two emissive hues: cyan on the crown, slots and beam; amber on the plinth fascia and pylon.",
        "Silver cap plates crown every pod and buttress and are the only low-roughness surfaces.",
        "No wear, dirt or damage anywhere; the only broken-up surface is loose gravel on the plinth.",
    ],
    "confidence": 0.85,
}]

spec["assumptions"] = [
    "Radial order is 6 for the plinth, foot, pod and fin rings, read from the plinth's visible "
    "corner angles rather than counted all the way round. Stated as a stylization.",
    "The crown collar repeats 8 times, read from the visible arc; a top-down view would settle it.",
    "The rear hemisphere is generated by radial repetition of the observed front, not observed.",
    "The front ground-level feature is built as a recessed entry ramp; the reference cannot "
    "distinguish a ramp from a door or a vent at this resolution.",
    "Bolt heads, the 3-dot status panel and seam widths are 1-3 px in a 156x199 reference, so "
    "they are reconstructed as plausible, not measured. The source sheet cannot provide a "
    "larger crop.",
    "The beam is volumeless light in the reference; representing it as additive emissive geometry "
    "is a representation choice, not a measurement.",
]

spec["risks"] = [
    {"id": "radial-order-wrong", "severity": "medium",
     "risk": "If the true order is 8 rather than 6, pod spacing reads too sparse from above.",
     "mitigation": "repetitionSystems.count is a single parameter per ring; changing it is a "
                   "one-line spec edit, not a rebuild."},
    {"id": "emissive-invisible-to-silhouette-gates", "severity": "high",
     "risk": "Silhouette IoU cannot see the emissive layout, which is the model's strongest "
             "identity signal; a Core with every light dead would pass a silhouette gate.",
     "mitigation": "interior_difference.py plus the emissive-layout featureReviewTarget are the "
                   "gates that actually read it."},
    {"id": "beam-dominates-framing", "severity": "medium",
     "risk": "The beam roughly doubles the model's bounding height, so an auto-framed review "
             "camera shrinks the keep itself to a third of the frame.",
     "mitigation": "Review viewpoints frame on the body bounds and treat the beam as an overlay."},
    {"id": "micro-detail-unverifiable", "severity": "low",
     "risk": "Panel decals and bolt layout cannot be scored against a 156 px reference.",
     "mitigation": "Those details carry confidence <= 0.7 and are excluded from the critical "
                   "feature set."},
]

spec["performanceBudget"] = {
    "qualityPriority": "reference-fidelity",
    "targetTriangles": 14000,
    "maxDrawCalls": 12,
    "textureSize": 512,
    "fpsTarget": 60,
    "optimizationPolicy": "This is an RTS structure drawn dozens of times per frame beside sixty "
                          "units, so the budget is a build constraint, not a post-pass: every ring "
                          "is one InstancedMesh and the six materials are shared across the tree.",
}

spec["lightingFromPhoto"] = [
    {"id": "key", "type": "directional", "directionHint": [-0.45, 0.82, 0.35],
     "colorHint": "#ffe9cc", "intensityHint": 2.1,
     "evidence": "Cap-plate highlights sit on the upper-front-left edge of every plate and the "
                 "cast shadow falls back and right."},
    {"id": "fill", "type": "hemisphere", "directionHint": [0, 1, 0],
     "colorHint": "#a9cde3", "intensityHint": 1.0,
     "evidence": "Shadowed faces stay legible and take a cool cast rather than going black."},
    {"id": "emissive-spill", "type": "point", "directionHint": [0, 1.19, 0],
     "colorHint": "#3fd8f5", "intensityHint": 1.2,
     "evidence": "The basin walls brighten toward the crown ring, which no external light in the "
                 "reference could produce."},
    {"id": "tone-mapping", "type": "render-setting",
     "exposure": 1.05, "toneMapping": "ACES filmic",
     "evidence": "The emissive strips clip to near-white at their centres while the steel keeps "
                 "its midtones, which is a filmic roll-off rather than a linear response. Matches "
                 "the game renderer, so a model reads the same in the lab and in a match."},
    {"id": "contact-shadow", "type": "shadow-behaviour",
     "groundShadow": True, "contactShadow": True, "ambientOcclusionIntensity": 0.9,
     "evidence": "A soft ground shadow sits under the plinth rim and AO darkens every tier seam "
                 "and recessed panel; without it the tiers read as stacked decals."},
]

spec["qualityTargets"] = {**spec["qualityTargets"],
    "targetFidelity": 0.75,
    "mustMatch": ["the stepped three-tier profile and its 0.71 height-to-width ratio",
                  "6-fold radial repetition on the lower rings",
                  "the two-hue emissive layout: cyan crown and slots, amber fascia and pylon",
                  "silver cap plates as the only low-roughness surfaces",
                  "the axial beam rising from a recessed glowing basin"],
    "niceToHave": ["the pylon status-panel decal layout",
                   "the exact gravel scatter on the plinth",
                   "bolt-head count around the plinth rim"],
    "reviewViewpoints": ["three-quarter-front", "front", "right-side", "rear", "top-down"]}

spec["featureReviewTargets"] = [
    {"id": "tier-profile", "name": "Stepped three-tier profile and radii",
     "tier": "critical", "passIds": ["blockout", "structural-pass"], "minimumScore": 0.8,
     "mustPass": True, "componentRefs": ["base-plinth", "lower-armour-ring", "mid-drum",
                                         "crown-collar"], "evidenceRefs": ["full-object"]},
    {"id": "radial-repetition", "name": "Radial pod, foot, fin and collar rings",
     "tier": "critical", "passIds": ["structural-pass", "form-refinement"], "minimumScore": 0.8,
     "mustPass": True, "componentRefs": ["buttress-foot", "lower-pod", "drum-fin",
                                         "crown-collar-plate"], "evidenceRefs": ["full-object"]},
    {"id": "emissive-layout", "name": "Two-hue emissive layout (cyan crown, amber fascia)",
     "tier": "critical", "passIds": ["material-pass", "lighting-pass"], "minimumScore": 0.8,
     "mustPass": True, "componentRefs": ["crown-ring", "pylon-head", "lower-pod", "entry-ramp"],
     "evidenceRefs": ["full-object"]},
    {"id": "beam-and-basin", "name": "Axial beam rising from the recessed glowing basin",
     "tier": "critical", "passIds": ["form-refinement", "material-pass"], "minimumScore": 0.8,
     "mustPass": True, "componentRefs": ["beam-column", "emitter-basin", "crown-ring"],
     "evidenceRefs": ["full-object"]},
    {"id": "trim-material-split", "name": "Silver trim against dark steel, gloss split",
     "tier": "critical", "passIds": ["material-pass", "surface-pass"], "minimumScore": 0.78,
     "mustPass": True, "componentRefs": ["pod-cap-plate", "lower-pod", "base-plinth"],
     "evidenceRefs": ["full-object"]},
    {"id": "pylon-break", "name": "Front pylon breaking the radial repetition",
     "tier": "important", "passIds": ["structural-pass"], "minimumScore": 0.65,
     "mustPass": False, "componentRefs": ["front-pylon", "pylon-head"],
     "evidenceRefs": ["full-object"]},
    {"id": "chamfer-read", "name": "Chamfered rims reading as bright edge bands",
     "tier": "important", "passIds": ["form-refinement", "surface-pass"], "minimumScore": 0.65,
     "mustPass": False, "componentRefs": ["base-plinth", "crown-collar-plate"],
     "evidenceRefs": ["full-object"]},
    {"id": "ramp-and-rubble", "name": "Entry ramp and plinth gravel scatter",
     "tier": "important", "passIds": ["form-refinement"], "minimumScore": 0.6,
     "mustPass": False, "componentRefs": ["entry-ramp", "base-plinth"],
     "evidenceRefs": ["full-object"]},
]

spec["animationAnchors"] = [
    "beam-column scales and pulses along Y from its base pivot; the aperture stays fixed",
    "crown-ring brightens and scales with the beam charge (materialState + scale channels)",
    "crown-collar-plate hinges outward about its own plate-hinge socket when the Core charges",
    "pylon-head switches emissive state to signal production without any transform",
    "root supports the whole-structure sink used when a Core is captured",
]

spec["destructionAnchors"] = [
    "fractureGroups run tier-0 (plinth) through tier-3 (collar and basin) so the keep collapses "
    "downward tier by tier rather than exploding outward",
    "the tier seams (plinth-to-ring, ring-to-drum, drum-to-collar) are the declared break planes",
    "lower-pod and crown-collar-plate carry detach:true and are the first fragments to leave",
    "beam-column has fractureGroup none: the light stops, it does not shatter",
]

spec["proceduralStrategy"] = [
    "Block out the four tier bodies as hexagonal prisms and check the stepped profile before any "
    "pod, fin or plate exists.",
    "Add the four radial rings as InstancedMesh systems driven by repetitionSystems, never as "
    "hand-placed copies.",
    "Chamfer the plinth rim and the collar plates as real geometry: the reference shows crisp "
    "bright edge lines that a normal map cannot produce.",
    "Bind the six shared materials, then attach local overrides for the tier-seam AO, the cap "
    "gloss and the pylon decal.",
    "Add the emissive layer last and verify it with interior_difference, not with silhouette IoU.",
    "Keep every ring instanced and every material shared to stay inside 14k triangles and 12 "
    "draw calls.",
]

# ------- carry the authored detail inventory into the spec ---------------------------------
di = json.loads(DI.read_text())
spec["preSpecAssessment"]["detailInventory"] = di["detailInventory"]
# Each unknown has been resolved by an explicit stylization decision, recorded in `assumptions`
# and `risks`; none is still open at implementation time.
spec["preSpecAssessment"]["unknownsToResolveBeforeImplementation"] = []

for build_pass in spec["buildPasses"]:
    build_pass["componentRefs"] = [c["id"] for c in tree]

if SPEC.exists():
    previous = json.loads(SPEC.read_text())
    # reviewHistory and the pass ledger are pipeline state, not authoring output: a refine-spec
    # iteration rewrites the reconstruction and must carry the record of why forward.
    for carried in ("reviewHistory", "sculptPipeline", "visualEvidence"):
        if previous.get(carried):
            spec[carried] = previous[carried]

SPEC.write_text(json.dumps(spec, indent=2) + "\n")
print(f"authored {len(tree)} components, {len(spec['materials'])} materials, "
      f"{len(spec['repetitionSystems'])} repetition systems")
