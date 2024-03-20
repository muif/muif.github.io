var simplemaps_countrymap_mapdata={
  main_settings: {
   //General settings
    width: "responsive", //'700' or 'responsive'
    background_color: "#FFFFFF",
    background_transparent: "yes",
    border_color: "#ffffff",
    
    //State defaults
    state_description: "",
    state_color: "#44232e",
    state_hover_color: "#c08865",
    state_url: "",
    border_size: 1.5,
    all_states_inactive: "no",
    all_states_zoomable: "yes",
    
    //Location defaults
    location_description: "العاصمة",
    location_url: "",
    location_color: "#FF0067",
    location_opacity: 0.8,
    location_hover_opacity: 1,
    location_size: 25,
    location_type: "square",
    location_image_source: "frog.png",
    location_border_color: "#FFFFFF",
    location_border: 2,
    location_hover_border: 2.5,
    all_locations_inactive: "no",
    all_locations_hidden: "no",
    
    //Label defaults
    label_color: "#ffffff",
    label_hover_color: "#ffffff",
    label_size: 30,
    label_font: "Arial",
    label_display: "auto",
    label_scale: "yes",
    hide_labels: "no",
    hide_eastern_labels: "no",
   
    //Zoom settings
    zoom: "yes",
    manual_zoom: "yes",
    back_image: "no",
    initial_back: "no",
    initial_zoom: "-1",
    initial_zoom_solo: "no",
    region_opacity: 1,
    region_hover_opacity: 0.6,
    zoom_out_incrementally: "yes",
    zoom_percentage: 0.99,
    zoom_time: 0.5,
    
    //Popup settings
    popup_color: "white",
    popup_opacity: 0.9,
    popup_shadow: 1,
    popup_corners: 5,
    popup_font: "12px/1.5 Verdana, Arial, Helvetica, sans-serif",
    popup_nocss: "no",
    
    //Advanced settings
    div: "map",
    auto_load: "yes",
    url_new_tab: "no",
    images_directory: "default",
    fade_time: 0.1,
    link_text: "الدخول الى الرابط",
    popups: "detect",
    state_image_url: "",
    state_image_position: "",
    location_image_url: ""
  },
  state_specific: {
    IQAN: {
      name: "الأنبار",
      url: "./anbar"
    },
    IQAR: {
      name: "أربيل",
      url: "./arbil"
    },
    IQBA: {
      name: "البصرة",
      url: "./basra"
    },
    IQBB: {
      name: "بابل",
      url: "./babl"
    },
    IQBG: {
      name: "بغداد",
      url: "./baghdad"
    },
    IQDA: {
      name: "دهوك",
      url: "./dhok"
    },
    IQDI: {
      name: "ديالى",
      url: "./Diyala"
    },
    IQDQ: {
      name: "ذي قار",
      url: "./Dhi-Qar"
    },
    IQKA: {
      name: "كربلاء",
      url: "./Karbala'"
    },
    IQMA: {
      name: "ميسان",
      url: "./Maysan"
    },
    IQMU: {
      name: "المثنى",
      url: "./Al-Muthannia"
    },
    IQNA: {
      name: "النجف",
      url: "./An-Najaf"
    },
    IQNI: {
      name: "نينوى",
      url: "./Ninawa"
    },
    IQQA: {
      name: "القادسية",
      url: "./Al-Qādisiyyah"
    },
    IQSD: {
      name: "صلاح الدين",
      url: "./Sala ad-Din"
    },
    IQSU: {
      name: "السليمانية",
      url: "./As-Sulaymaniyah"
    },
    IQTS: {
      name: "كركوك",
      url: "./At-Ta'mim"
    },
    IQWA: {
      name: "واسط",
      url: "./Wasit"
    }
  },
  locations: {
    "0": {
      name: "بغداد",
      lat: "33.340582",
      lng: "44.400876"
    }
  },
  labels: {
    IQAN: {
      name: "الانبار",
      parent_id: "IQAN"
    },
    IQAR: {
      name: "اربيل",
      parent_id: "IQAR"
    },
    IQBA: {
      name: "البصرة",
      parent_id: "IQBA"
    },
    IQBB: {
      name: "بابل",
      parent_id: "IQBB"
    },
    IQBG: {
      name: "بغداد",
      parent_id: "IQBG"
    },
    IQDA: {
      name: "دهوك",
      parent_id: "IQDA"
    },
    IQDI: {
      name: "ديالى",
      parent_id: "IQDI"
    },
    IQDQ: {
      name: "ذي قار",
      parent_id: "IQDQ"
    },
    IQKA: {
      name: "كربلاء'",
      parent_id: "IQKA"
    },
    IQMA: {
      name: "ميسان",
      parent_id: "IQMA"
    },
    IQMU: {
      name: "المثنى",
      parent_id: "IQMU"
    },
    IQNA: {
      name: "النجف",
      parent_id: "IQNA"
    },
    IQNI: {
      name: "نينوى",
      parent_id: "IQNI"
    },
    IQQA: {
      name: "القادسية",
      parent_id: "IQQA"
    },
    IQSD: {
      name: "صلاح الدين",
      parent_id: "IQSD"
    },
    IQSU: {
      name: "السليمانية",
      parent_id: "IQSU"
    },
    IQTS: {
      name: "كركوك",
      parent_id: "IQTS"
    },
    IQWA: {
      name: "واسط",
      parent_id: "IQWA"
    }
  },
  legend: {
    entries: []
  },
  regions: {}
};
