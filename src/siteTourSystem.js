// The system the site tour (SiteTour.jsx, F19) builds and checks: rain, a bio-sand filter, a
// gravity-fed shower, checked in Finistère. Shared with vite.config.js, which works out the
// verdict at build time so the home page never loads the check's engine and climate data.
export const RAIN = 'SOL-053'
export const FILTER = 'SOL-131'
export const SHOWER = 'SOL-091'
export const DEPT = '29'   // Finistère: rainy, and still borderline (F19-i)

export const GRAPH = {
  linkedOnly: true,
  nodes: [{ id: 'a', sol: RAIN }, { id: 'b', sol: FILTER }, { id: 'c', sol: SHOWER }],
  edges: [{ from: 'a', to: 'b', ios: ['IO-16'] }, { from: 'b', to: 'c', ios: ['IO-09'] }],
}
