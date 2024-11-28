const sources = {
  video: {
    type: 'video',
    title: 'View From A Blue Moon',
    sources: [
      {
        src: 'https://live1.beinconnect.us/YallaGoalApp/beINSports1.m3u8',
        type: 'video/mp4',
        size: 576,
      },
      {
        src: 'https://live1.beinconnect.us/YallaGoalApp/beINSports1.m3u8',
        type: 'video/mp4',
        size: 720,
      },
      {
        src: 'https://live1.beinconnect.us/YallaGoalApp/beINSports1.m3u8',
        type: 'video/mp4',
        size: 1080,
      },
      {
        src: 'https://live1.beinconnect.us/YallaGoalApp/beINSports1.m3u8',
        type: 'video/mp4',
        size: 1440,
      },
    ],
    poster: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-HD.jpg',
    tracks: [
      {
        kind: 'captions',
        label: 'English',
        srclang: 'en',
        src: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-HD.en.vtt',
        default: true,
      },
      {
        kind: 'captions',
        label: 'French',
        srclang: 'fr',
        src: 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-HD.fr.vtt',
      },
    ],
    previewThumbnails: {
      src: ['https://cdn.plyr.io/static/demo/thumbs/100p.vtt', 'https://cdn.plyr.io/static/demo/thumbs/240p.vtt'],
    },
  },
  audio: {
    type: 'audio',
    title: 'Kishi Bashi &ndash; &ldquo;It All Began With A Burst&rdquo;',
    sources: [
      {
        src: 'https://cdn.plyr.io/static/demo/Kishi_Bashi_-_It_All_Began_With_a_Burst.mp3',
        type: 'audio/mp3',
      },
      {
        src: 'https://cdn.plyr.io/static/demo/Kishi_Bashi_-_It_All_Began_With_a_Burst.ogg',
        type: 'audio/ogg',
      },
    ],
  },
  youtube: {
    type: 'video',
    sources: [
      {
        src: 'https://youtube.com/watch?v=bTqVqk7FSmY',
        provider: 'youtube',
      },
    ],
  },
  vimeo: {
    type: 'video',
    sources: [
      {
        src: 'https://vimeo.com/40648169',
        provider: 'vimeo',
      },
    ],
  },
};

export default sources;
