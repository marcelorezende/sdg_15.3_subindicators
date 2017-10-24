var CLIENT_ID = '77627108579-j0l3i61gohagfva9vjgnii4kjutitren.apps.googleusercontent.com';

//Google Map
var map;

//Generate Systematic Grid Over a Country
//EE Spcript to Generate Systematic Grid Over a Country
var generateGrid = function() {
  //Initialize EE
  ee.initialize();

  map.overlayMapTypes.clear();

  //Import Topography Model image and Country Boundaries feature collection.
  var srtm = ee.Image("USGS/SRTMGL1_003");
  var gaul = ee.FeatureCollection(GAULSRC);

  //Define the country, projection and distance between plots (in meters) based on user input
  var country = $('#selectedCountry').find(":selected").text();
  var distanceBetweenPlots = parseInt($('#distanceBetweenPlots').val().replace(/,/g, ""), 10);
  var projection = $('#projection').val();

  //Filter country of Interest based on selection above
  country = gaul.filterMetadata('adm0_name', 'equals', country).geometry();

  //Stack the interesting bands
  var dtm = ee.Algorithms.Terrain(srtm);
  var lonlat = ee.Image.pixelLonLat();
  var stack = (dtm).addBands(lonlat);

  //Sample the stack of bands (image) over the country
  var points = stack.sample(country, distanceBetweenPlots, ee.Projection(projection));

  //Give the features a geometry so that they can be merged with the shapefiles
  var points = points.map(
    function(plot) {
      // Keep this list of properties.
      var keepProperties = ['latitude',
        'longitude',
        'elevation',
        'slope',
        'aspect',
      ];
      var centroid = ee.Geometry.Point([plot.get("longitude"), plot.get("latitude")]);
      // Select the properties from the feature, overwrite the geometry.
      return ee.Feature(centroid).copyProperties(plot, keepProperties)
    }
  );

  //Create the map layer to push to the Google Map
  var eeMapConfig = points.getMap();
  var eeTileSource = new ee.layers.EarthEngineTileSource(
    'https://earthengine.googleapis.com/map',
    eeMapConfig.mapid, eeMapConfig.token);
  var overlay = new ee.layers.ImageOverlay(eeTileSource);

  //Extract information for the points and export a link to download the CSV
  var downloadlink = ee.FeatureCollection(points)
    .getDownloadURL(
      'csv', [
        'system:index',
        'latitude',
        'longitude',
        'elevation',
        'slope',
        'aspect'
      ]
    );

  // Push the generated layer to the Google Map
  map.overlayMapTypes.push(overlay);

  //Enable Download button for the CSV file
  $('#downloadbtlink').attr('href', downloadlink);
  $('#downloadbt').removeAttr('disabled');
  $('#downloadbt').html(DOWNLOADMESSAGE);

  var newBoundries = country.bounds().coordinates().getInfo();
  centerMap(newBoundries)
};

function runEE() {
  $('#downloadbt').prop('disabled', true);
  $('#downloadbt').html(GENERATINGMESSAGE);

  ee.data.authenticateViaOauth(CLIENT_ID, generateGrid, null, null, onImmediateFailed);
};

function centerMap(bound) {
  var ne = new google.maps.LatLng(bound[0][2][1], bound[0][2][0]);
  var sw = new google.maps.LatLng(bound[0][0][1], bound[0][0][0]);

  var bounds = new google.maps.LatLngBounds(sw, ne);
  map.fitBounds(bounds);
}

//Function used to get the countries names from the GeoTable
var listCountries = function() {
  ee.initialize;
  var gaul = ee.FeatureCollection(GAULSRC);
  var countriesArray = gaul.aggregate_array('adm0_name').getInfo();
  $.each(countriesArray, function(val, text) {
    $('#selectedCountry').append($('<option></option>').val(val).html(text))
  });
  $("#selectedCountry option[value='loadingmessage']").remove();
  $('#selectedCountry').removeAttr('disabled');
}

$(document).ready(function() {
  // Create the base Google Map.
  map = new google.maps.Map($('#map').get(0), {
    center: {
      lat: 0,
      lng: 0
    },
    zoom: 3,
    streetViewControl: false,
    fullscreenControl: false
  });
  $('#downloadbt').html(DOWNLOADMESSAGE);
  $("#selectedCountry").append('<option value="loadingmessage">' + LOADINCOUNTRIESMESSAGE + '</option>');
  //Get the countries list from the GeoTable TODO: Check for alternatives
  ee.data.authenticateViaOauth(CLIENT_ID, listCountries, null, null, onImmediateFailed);
});


///////////////////////////////////////////////////////////////////////////////
//                        Static helpers and constants.                      //
///////////////////////////////////////////////////////////////////////////////

// Shows a button prompting the user to log in.
var onImmediateFailed = function() {
  $('.g-sign-in').removeClass('hidden');
  $('.output').text('(Log in to see the result.)');
  $('.g-sign-in .button').click(function() {
    ee.data.authenticateViaPopup(function() {
      // If the login succeeds, hide the login button and run the analysis.
      $('.g-sign-in').addClass('hidden');
    });
  });
};

const DOWNLOADMESSAGE = 'Download CSV';
const GENERATINGMESSAGE = '<i class="fa fa-spinner fa-spin"></i> Generating Grid';
const LOADINCOUNTRIESMESSAGE = 'Loading countries list';
const PROJECTION = 'EPSG:4826';
const GAULSRC = "users/marceloarvore/FAO-GAUL-2015_2014_0";
