// The worked example offered from the empty canvas (positions laid out left to right by Eric,
// 2026-09-23, from a shared link), in exactly the shape serializeTree()
// writes, so it loads through hydrateTree() with names and labels derived in the reading
// language.
//
// Rainwater harvesting and storage  SOL-053  --[Raw water  IO-16]-->
// Bio-sand filter  SOL-131  --[Potable Water  IO-09]-->
// Gravity-fed shower  SOL-091  --[Greywater  IO-10]-->
// Direct greywater diversion to toilet flushing  SOL-153
//
// Deliberately incomplete: do not finish it. An unresolved input is a button, and clicking it
// is how a reader discovers the graph suggests what could fill the gap.
export const EXAMPLE_TREE = {
  nodes: [
    { id: 'ex1', sol: 'SOL-053', position: { x: -106, y: -78 } },
    { id: 'ex2', sol: 'SOL-131', position: { x: 169, y: 87 } },
    { id: 'ex3', sol: 'SOL-091', position: { x: 427, y: -37 } },
    { id: 'ex4', sol: 'SOL-153', position: { x: 677, y: 75 } },
  ],
  edges: [
    { id: 'e-ex1-ex2-IO-16', source: 'ex1', target: 'ex2', io: 'IO-16' },
    { id: 'e-ex2-ex3-IO-09', source: 'ex2', target: 'ex3', io: 'IO-09' },
    { id: 'e-ex3-ex4-IO-10', source: 'ex3', target: 'ex4', io: 'IO-10' },
  ],
  counter: 4,
}

// The second example, power: it starts from a natural resource node and it branches, two things
// the water chain cannot show.
//
// Solar Radiation  IO-01  --[Solar Radiation  IO-01]-->
// Solar PV array  SOL-076  --[DC Electricity  IO-18]-->  two ways:
// Inverter (DC to AC)  SOL-082
// Direct solar power  SOL-190  --[DC Electricity  IO-18]-->  Solar-powered oven  SOL-191
//
// Incomplete for the same reason: the open ends are buttons.
export const EXAMPLE_TREE_POWER = {
  nodes: [
    { id: 'px0', res: 'IO-01', position: { x: -47, y: 4 } },
    { id: 'px1', sol: 'SOL-076', position: { x: 202, y: 3 } },
    { id: 'px2', sol: 'SOL-082', position: { x: 451, y: 161 } },
    { id: 'px3', sol: 'SOL-190', position: { x: 451, y: -149 } },
    { id: 'px4', sol: 'SOL-191', position: { x: 745, y: -67 } },
  ],
  edges: [
    { id: 'e-px0-px1-IO-01', source: 'px0', target: 'px1', io: 'IO-01' },
    { id: 'e-px1-px2-IO-18', source: 'px1', target: 'px2', io: 'IO-18' },
    { id: 'e-px1-px3-IO-18', source: 'px1', target: 'px3', io: 'IO-18' },
    { id: 'e-px3-px4-IO-18', source: 'px3', target: 'px4', io: 'IO-18' },
  ],
  counter: 5,
}

/** The examples offered from the empty canvas, keyed by the string that names them. */
export const EXAMPLES = { water: EXAMPLE_TREE, power: EXAMPLE_TREE_POWER }
