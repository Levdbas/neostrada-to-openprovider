require("dotenv").config();

const fs = require("fs");
const axios = require("axios");
const NEOSTRADA_API_URL = "https://api.neostrada.com/api";
const NEOSTRADA_API_KEY = process.env.NEOSTRADA_API_KEY;
/**
 * Fetches DNS records for a given DNS ID from the Neostrada API.
 *
 * @async
 * @param {string} dnsId - The ID of the DNS record to fetch.
 * @returns {Promise<Object[]>} A promise that resolves to an array of DNS records.
 *                              Returns an empty array if an error occurs or no records are found.
 * @throws {Error} Logs an error message if the API request fails.
 */
async function getDomains() {
   try {
      const response = await axios.get(`${NEOSTRADA_API_URL}/domains`, {
         headers: { Authorization: `Bearer ${NEOSTRADA_API_KEY}` },
      });

      console.log(response.data.results);
      if (response.data.results) {
         return response.data.results;
      } else {
         console.error(`❌ Fout bij ophalen records: ${response.data.message}`);
      }
   } catch (error) {
      console.error("❌ API-fout bij ophalen records:", error.message);
   }
   return [];
}

function filterResult(records) {

   // filter out records that have is_external set to 1


   records = records.filter(record => record.is_external === 0);

   // filter our domains that have a status of 'cancelled'
   records = records.filter(record => record.status !== 'cancelled');

   return records;
}

async function main() {
   const records = await getDomains();
   const filteredRecords = filterResult(records);

   fs.writeFileSync
      (`./output/all-domains.json`, JSON.stringify(filteredRecords, null, 2), 'utf8');
   console.log(`✅ /output/all-domains.json is aangemaakt`);
}

main();