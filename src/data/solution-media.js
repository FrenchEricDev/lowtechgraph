/*
 * R1 (Eric, 2026-11-22: kept): a photo and a video beside the drawing, as tabs, so a solution page
 * shows the real thing without growing longer. The Video tab needs no entry here (any YouTube
 * tutorial); photos are listed here until the photo pass (TODO R1-b) moves them to the workbook.
 *
 * Photos are copies of Wikimedia Commons files under a licence that allows reuse with credit, kept
 * in public/photos/ so a reader's browser never calls a third party to show them (and so they work
 * offline). Each one carries what its licence asks: the author, the licence and a link to the file.
 * The video is the solution's own video tutorial, and is not loaded until the reader asks for it.
 *
 */
export const SOLUTION_MEDIA = {
  'SOL-136': {
    photo: {
      src: '/photos/sol-136.jpg', w: 960, h: 720,
      alt: {
        en: 'A rocket stove built of concrete blocks and clay outdoors, with its chimney and an oven beside it',
        fr: 'Un poêle-fusée en parpaings et en terre, dehors, avec sa cheminée et un four à côté',
      },
      author: 'Sarah and Jason', licence: 'CC BY-SA 2.0',
      licence_url: 'https://creativecommons.org/licenses/by-sa/2.0',
      page: 'https://commons.wikimedia.org/wiki/File:Rocket_Stove_with_Oven.jpg',
    },
  },
  'SOL-059': {
    photo: {
      src: '/photos/sol-059.jpg', w: 960, h: 720,
      alt: {
        en: 'A solar water heater on the ground in a garden: flat collector panels with the hot-water tank across their top',
        fr: 'Un chauffe-eau solaire posé au sol dans un jardin : des capteurs plans, le ballon d’eau chaude couché au-dessus',
      },
      author: 'David Monniaux', licence: 'CC BY-SA 3.0',
      licence_url: 'https://creativecommons.org/licenses/by-sa/3.0/',
      page: 'https://commons.wikimedia.org/wiki/File:Solar_heater_dsc00632.jpg',
    },
  },
}

// The video tab plays the solution's first YouTube tutorial, in the reading language if it has one.
export const youtubeId = (url) => {
  const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/.exec(url || '')
  return m ? m[1] : null
}
