function display_kmlmap()
{
    // A map needs 2 things - a place to put it and map options
    var map_options = { };  
    var map = new google.maps.Map(document.getElementById("map_canvas"),map_options);

    // OK - now we have a map, now let's display some kml - for this you need
    // to create a kmlLayer. You can add multple of these to a map in the kmlOptions
    
    // A kml layer needs 2 things - a kml file and a set of options
    // I selected a random kml file - but since I did not give a location for the 
    // map in map options - the kml file better do this 
    
    var kmlUrl = 'https://muif.github.io/map_files/مشروع%20بلا%20عنوان.kml';
   var kmlOptions = { map: map};

    // Create the kmlLayer - and you are done
    var kmlLayer = new google.maps.KmlLayer(kmlUrl, kmlOptions);
}
