import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const nicheMap: Record<string, string> = {
  dentista: "amenity=dentist",
  restaurante: "amenity=restaurant",
  academia: "leisure=fitness_centre",
  "clinica estetica": "shop=beauty",
  estetica: "shop=beauty",
  advogado: "office=lawyer",
  imobiliaria: "office=estate_agent",
  escola: "amenity=school",
  "pet shop": "shop=pet",
  petshop: "shop=pet",
  "salao de beleza": "shop=hairdresser",
  salao: "shop=hairdresser",
  cabeleireiro: "shop=hairdresser",
  medico: "amenity=doctors",
  "consultorio medico": "amenity=doctors",
  clinica: "amenity=clinic",
  farmacia: "amenity=pharmacy",
  padaria: "shop=bakery",
  contabilidade: "office=accountant",
  contador: "office=accountant",
  "loja de roupas": "shop=clothes",
  roupas: "shop=clothes",
  "oficina mecanica": "shop=car_repair",
  oficina: "shop=car_repair",
  hospital: "amenity=hospital",
  hotel: "tourism=hotel",
  cafe: "amenity=cafe",
  cafeteria: "amenity=cafe",
  bar: "amenity=bar",
  mercado: "shop=supermarket",
  supermercado: "shop=supermarket",
  pizzaria: "amenity=restaurant",
  hamburgueria: "amenity=fast_food",
  "fast food": "amenity=fast_food",
  lanchonete: "amenity=fast_food",
  igreja: "amenity=place_of_worship",
  otica: "shop=optician",
  relojoaria: "shop=watches",
  floricultura: "shop=florist",
  livraria: "shop=books",
  papelaria: "shop=stationery",
  veterinario: "amenity=veterinary",
  lavanderia: "shop=laundry",
  autoescola: "amenity=driving_school",
  banco: "amenity=bank",
  loteria: "amenity=lottery",
  cartorio: "office=notary",
  corretor: "office=insurance",
  seguranca: "office=security",
  academia: "leisure=fitness_centre",
  crossfit: "leisure=fitness_centre",
  pilates: "leisure=fitness_centre",
  yoga: "leisure=fitness_centre",
  piscina: "leisure=swimming_pool",
  fisioterapia: "healthcare=physiotherapist",
  psicologia: "healthcare=psychotherapist",
  psicologo: "healthcare=psychotherapist",
  nutricionista: "healthcare=dietitian",
  fonoaudiologia: "healthcare=speech_therapist",
  ortopedia: "healthcare=doctor",
};

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city + ", Brasil")}&format=json&limit=1&countrycodes=br`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SQUAAD-CRM/1.0 (prospeccao-digital)" },
  });
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function searchOverpass(
  query: string,
  city: string,
  lat: number,
  lon: number,
  radius: number = 15000
): Promise<any[]> {
  const queryLower = query.toLowerCase().trim();
  const osmTag = nicheMap[queryLower];

  let overpassQuery: string;
  if (osmTag) {
    const [tagKey, tagValue] = osmTag.split("=");
    overpassQuery = `[out:json][timeout:15];(node["${tagKey}"="${tagValue}"](around:${radius},${lat},${lon});way["${tagKey}"="${tagValue}"](around:${radius},${lat},${lon}););out body 30;`;
  } else {
    // Generic name search
    overpassQuery = `[out:json][timeout:15];(node["name"~"${query}",i](around:${radius},${lat},${lon});way["name"~"${query}",i](around:${radius},${lat},${lon}););out body 30;`;
  }

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });

  const data = await res.json();
  const elements = data.elements || [];

  return elements
    .filter((el: any) => el.tags?.name)
    .map((el: any) => {
      const tags = el.tags || {};
      const addressParts = [
        tags["addr:street"],
        tags["addr:housenumber"],
        tags["addr:suburb"],
        tags["addr:city"] || city,
      ].filter(Boolean);

      return {
        name: tags.name,
        address: addressParts.length > 0 ? addressParts.join(", ") : null,
        rating: null,
        reviews: null,
        phone: tags.phone || tags["contact:phone"] || null,
        website: tags.website || tags["contact:website"] || null,
        instagram: tags["contact:instagram"] || null,
        opening_hours: tags.opening_hours || null,
        maps_url: `https://www.google.com/maps/search/${encodeURIComponent(tags.name + " " + city)}`,
      };
    });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { query, city } = await req.json();
    if (!query || !city) {
      return new Response(
        JSON.stringify({ error: "query and city are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Geocode city
    const geo = await geocodeCity(city);
    if (!geo) {
      return new Response(
        JSON.stringify({
          results: [],
          source: "error",
          message: `Cidade "${city}" nao encontrada. Verifique o nome.`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search via OpenStreetMap Overpass API (free, no key needed)
    let results = await searchOverpass(query, city, geo.lat, geo.lon);

    // If no results with default radius, try larger radius
    if (results.length === 0) {
      results = await searchOverpass(query, city, geo.lat, geo.lon, 30000);
    }

    // If still no results with tag mapping, try generic name search
    if (results.length === 0 && nicheMap[query.toLowerCase().trim()]) {
      const genericQuery = `[out:json][timeout:15];(node["name"~"${query}",i](around:20000,${geo.lat},${geo.lon});way["name"~"${query}",i](around:20000,${geo.lat},${geo.lon}););out body 30;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(genericQuery)}`,
      });
      const data = await res.json();
      results = (data.elements || [])
        .filter((el: any) => el.tags?.name)
        .map((el: any) => ({
          name: el.tags.name,
          address: [el.tags["addr:street"], el.tags["addr:housenumber"], el.tags["addr:city"] || city].filter(Boolean).join(", ") || null,
          rating: null,
          reviews: null,
          phone: el.tags.phone || el.tags["contact:phone"] || null,
          website: el.tags.website || el.tags["contact:website"] || null,
          instagram: el.tags["contact:instagram"] || null,
          opening_hours: el.tags.opening_hours || null,
          maps_url: `https://www.google.com/maps/search/${encodeURIComponent(el.tags.name + " " + city)}`,
        }));
    }

    // Sort: results with more data first
    results.sort((a: any, b: any) => {
      const scoreA = (a.phone ? 2 : 0) + (a.address ? 1 : 0) + (a.website ? 1 : 0);
      const scoreB = (b.phone ? 2 : 0) + (b.address ? 1 : 0) + (b.website ? 1 : 0);
      return scoreB - scoreA;
    });

    return new Response(
      JSON.stringify({
        results: results.slice(0, 20),
        source: "openstreetmap",
        total: results.length,
        query: `${query} em ${city}`,
        maps_search_url: `https://www.google.com/maps/search/${encodeURIComponent(query + " em " + city)}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("search-prospects error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
