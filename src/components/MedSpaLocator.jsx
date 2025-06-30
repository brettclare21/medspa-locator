// Main React component for the Med Spa Locator App
import { useState, useEffect, useRef } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MapPin, Search, Navigation, Globe } from "lucide-react";

const Input = (props) => (
  <input
    {...props}
    className="border px-3 py-2 rounded-md text-sm shadow-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-300"
  />
);

const Button = ({ children, className = "", variant, ...props }) => {
  const base =
    variant === "outline"
      ? "border border-gray-300 text-gray-800 bg-white hover:bg-gray-100"
      : "bg-blue-600 text-white hover:bg-blue-700";
  return (
    <button {...props} className={`px-4 py-2 rounded-md w-full text-sm ${base} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, index }) => (
  <div
    className={`
      ${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'}
      border border-gray-300 
      rounded-xl shadow-md 
      w-full mb-4 p-4 
      transition-all duration-200 
      hover:shadow-lg hover:border-blue-400 hover:bg-blue-50
    `}
  >
    {children}
  </div>
);

const CardContent = ({ children, className }) => <div className={className}>{children}</div>;

export default function MedSpaLocator() {
  const [map, setMap] = useState(null);
  const [location, setLocation] = useState(null);
  const [radius, setRadius] = useState(10);
  const [results, setResults] = useState([]);
  const [zip, setZip] = useState("");
  const watchId = useRef(null);

  const keywords = [
    "med spa",
    "aesthetic clinic",
    "dermatology",
    "botox",
    "lip filler",
    "facial spa",
    "cosmetic dermatology"
  ];

  const radiusOptions = [5, 10, 25, 50];
  const apiKey = "AIzaSyBgTPhbMRch9cVLeLnwS_nuvMyIbTCnxsQ";

  useEffect(() => {
    const loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });
    loader.load().then(() => {
      const mapInstance = new window.google.maps.Map(document.getElementById("map"), {
        center: { lat: 33.1581, lng: -117.3506 },
        zoom: 10,
      });
      setMap(mapInstance);
    });

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const geocodeZip = async (zip) => {
    const geocoder = new window.google.maps.Geocoder();
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address: zip }, (results, status) => {
        if (status === "OK" && results[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          reject("Geocode failed");
        }
      });
    });
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 0.621371;
  };

  const fetchPlaceDetails = (placeId) => {
    return new Promise((resolve) => {
      const service = new window.google.maps.places.PlacesService(map);
      service.getDetails({ placeId, fields: ["formatted_phone_number", "website", "url"] }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          resolve(place);
        } else {
          resolve({});
        }
      });
    });
  };

  const searchPlaces = async (lat, lng) => {
    const service = new window.google.maps.places.PlacesService(map);
    const found = [];

    for (const keyword of keywords) {
      const request = {
        location: new window.google.maps.LatLng(lat, lng),
        radius: radius * 1609.34,
        keyword: keyword,
      };
      await new Promise((resolve) => {
        service.nearbySearch(request, async (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            for (let place of results) {
              const details = await fetchPlaceDetails(place.place_id);
              const distance = calculateDistance(lat, lng, place.geometry.location.lat(), place.geometry.location.lng());
              found.push({ ...place, ...details, distance });
            }
          }
          resolve();
        });
      });
    }

    const unique = Array.from(new Map(found.map(p => [p.place_id, p])).values());
    unique.sort((a, b) => a.distance - b.distance);
    setResults(unique);
    map.setCenter({ lat, lng });
    map.setZoom(12);
    unique.forEach((place) => {
      const marker = new window.google.maps.Marker({
        position: place.geometry.location,
        map,
        title: place.name,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `<div style="font-size:14px;"><strong>${place.name}</strong><br>${place.vicinity}</div>`
      });

      marker.addListener("click", () => {
        infoWindow.open(map, marker);
      });
    });
  };

  const handleSearch = async () => {
    try {
      const loc = await geocodeZip(zip);
      setLocation(loc);
      searchPlaces(loc.lat, loc.lng);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(loc);
          searchPlaces(loc.lat, loc.lng);
        },
        (error) => {
          console.error("Error watching location:", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      console.error("Geolocation not supported");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 grid gap-4 max-w-md mx-auto sm:max-w-2xl lg:max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2 sm:gap-4">
        <img src="/logo.svg" alt="Logo" className="h-10" />
        <h1 className="text-2xl font-bold text-gray-800 text-center sm:text-left">Med Spa Locator</h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
        <Input placeholder="Enter ZIP code" value={zip} onChange={(e) => setZip(e.target.value)} />
        <select
          className="border rounded-md px-3 py-2 w-full text-sm"
          value={radius}
          onChange={(e) => setRadius(parseInt(e.target.value))}
        >
          {radiusOptions.map((r) => (
            <option key={r} value={r}>
              {r} miles
            </option>
          ))}
        </select>
        <Button onClick={handleSearch}>
          <Search className="mr-2 h-4 w-4" /> Search
        </Button>
        <Button variant="outline" onClick={handleUseMyLocation}>
          <MapPin className="mr-2 h-4 w-4" /> Use My Location
        </Button>
      </div>

      <div id="map" className="h-[50vh] sm:h-[60vh] rounded shadow w-full" />
      <a href="#results" className="text-sm text-blue-600 underline text-center block mt-2">
        Jump to results
      </a>

      <div className="grid gap-6" id="results">
        {results.map((place, idx) => (
          <Card key={idx} index={idx}>
            <CardContent>
              <div className="font-bold text-lg text-gray-900 mb-1">{place.name}</div>
              <div className="text-sm text-gray-600 mb-1">{place.vicinity}</div>
              <div className="text-sm text-gray-600 mb-2">{place.distance.toFixed(1)} miles away</div>
              <div className="flex flex-wrap items-center justify-start gap-4 text-sm mb-4">
                {place.formatted_phone_number && (
                  <a href={`tel:${place.formatted_phone_number}`} className="text-blue-600 underline">
                    {place.formatted_phone_number}
                  </a>
                )}
                {place.website && (
                  <a href={place.website} className="text-blue-600 underline truncate max-w-[8rem]" target="_blank" rel="noopener noreferrer">
                    {new URL(place.website).hostname.replace("www.", "")}
                  </a>
                )}
                {place.url && (
                  <a href={place.url} className="text-blue-600 underline flex items-center" target="_blank" rel="noopener noreferrer">
                    <Navigation className="inline h-4 w-4 mr-1" /> Directions
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
