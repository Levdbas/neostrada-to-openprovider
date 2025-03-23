require("dotenv").config();

const fs = require("fs");
const axios = require("axios");

// API Configuratie
const NEOSTRADA_API_KEY = process.env.NEOSTRADA_API_KEY;
const OPENPROVIDER_API_KEY = process.env.OPENPROVIDER_API_KEY;
const JSON_FILE = process.env.JSON_FILE;

// API Endpoints
const NEOSTRADA_API_URL = "https://api.neostrada.com/api/dns";
const OPENPROVIDER_API_URL = "https://api.openprovider.eu/v1beta/dns/zones";


/**
 * Loads a list of domains from a JSON file.
 *
 * @returns {Array} An array of domain objects if the JSON file is successfully read and parsed,
 *                  or an empty array if an error occurs.
 */
function loadDomains() {
   try {
      const data = fs.readFileSync(JSON_FILE, "utf8");
      return JSON.parse(data).domains || [];
   } catch (error) {
      console.error("❌ Fout bij het laden van het JSON-bestand:", error.message);
      return [];
   }
}

/**
 * Fetches DNS records for a given DNS ID from the Neostrada API.
 *
 * @async
 * @param {string} dnsId - The ID of the DNS record to fetch.
 * @returns {Promise<Object[]>} A promise that resolves to an array of DNS records.
 *                              Returns an empty array if an error occurs or no records are found.
 * @throws {Error} Logs an error message if the API request fails.
 */
async function getDnsRecords(dnsId) {
   try {
      const response = await axios.get(`${NEOSTRADA_API_URL}/${dnsId}`, {
         headers: { Authorization: `Bearer ${NEOSTRADA_API_KEY}` },
      });

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

/**
 * Filter out records that are not needed
 * 
 * @param {*} records The array  of records to be filtered 
 * @returns  The filtered array of records
 */
function filterRecords(records) {
   records = records.filter((record) => !["SOA", "NS"].includes(record.type));

   // loop through the records and remove records that do not have a key 'content'
   records = records.filter(record => record.hasOwnProperty('content'));

   // if record name value contains localhost, remove the record
   records = records.filter(record => !record.name.includes('localhost'));

   // if record type is CNAME and name contains 'email.mg', remove the record
   records = records.filter(record => !(record.type === 'CNAME' && record.name.includes('email.mg')));

   return records;
}

//  a function that loops through the recods and remove id and domainID from the record
function sanitizeDnsRecords(records, domain) {

   // loop through records, remove id and domainId and change the key "value" to "content"
   records = records.map(record => {
      delete record.id;
      delete record.domainId;
      record.value = record.content;
      delete record.content;

      return record;
   });

   // loop through records, if the key "name" contains 2 or more dots, remove everything after the second last dot
   records = records.map(record => {
      if (record.name.split('.').length > 2) {
         const nameParts = record.name.split('.');
         record.name = nameParts.slice(0, nameParts.length - 2).join('.');
      }

      return record
   });

   // If the value of the record is exactly the domain, make the name empty, so we just add the record on the root domain.
   records = records.map(record => {
      if (record.name === domain) {
         record.name = '';
      }

      return record;
   }
   );

   return records;
}


/**
 * Creates a DNS zone in Openprovider for the specified domain and records.
 *
 * @async
 * @function createOpenproviderZone
 * @param {string} domain - The domain name for which the DNS zone will be created (e.g., "example.com").
 * @param {Array<Object>} records - An array of DNS record objects to be added to the zone.
 * @throws {Error} Throws an error if the API request fails.
 * @returns {Promise<void>} A promise that resolves when the DNS zone is successfully created.
 */
async function createOpenproviderZone(domain, records) {

   // get the extension of the domain
   const domainParts = domain.split(".");
   const extension = domainParts[domainParts.length - 1];
   const name = domainParts[0];

   try {
      const response = await axios.post(
         OPENPROVIDER_API_URL,
         {
            "domain": {
               "extension": extension,
               "name": name,
            },
            "provider": "openprovider",
            "records": records,
            "secured": true,
            "template_name": "api",
            "type": "master"
         },
         { headers: { Authorization: `Bearer ${OPENPROVIDER_API_KEY}`, "Content-Type": "application/json" } }
      );

      if (response.data.data.success) {
         console.log(`✅ Succes: DNS-zone aangemaakt voor ${domain}`);
      } else {
         console.error(`❌ Fout bij aanmaken DNS-zone voor ${domain}: ${response.data.desc}`);
      }
   } catch (error) {

      console.error(`❌ API-fout bij aanmaken DNS-zone voor ${domain}`);
      console.error(`Error code: ${error.response.data.code}`)
      console.error(`Beschrijving: ${error.response.data.desc}`)
   }
}

/**
 * Migrate DNS records from Neostrada to Openprovider
 * 
 * This function loads the domains from a JSON file and then loops through each domain to get the DNS records from Neostrada.
 * The records are then filtered and sanitized before being saved to a JSON file and migrated to Openprovider.
 * 
 * @returns 
 */
async function migrateDns() {
   const domains = loadDomains();
   if (domains.length === 0) {
      console.log("⚠️ Geen domeinen gevonden om te migreren.");
      return;
   }

   for (const { domain, dns_id: dnsId } of domains) {
      console.log(`➡️ Ophalen van DNS-records voor ${domain} (ID: ${dnsId})...`);
      let records = false;

      // if /output/the-domain.json already exists, get the records from the file
      if (fs.existsSync(`./output/${domain}.json`)) {
         const data = fs.readFileSync
            (`./output/${domain}.json`, 'utf8');
         records = JSON.parse(data);
         console.log(`✅ ${domain}.json is gevonden en geladen`);
      } else {
         records = await getDnsRecords(dnsId);
         records = filterRecords(records);
         records = sanitizeDnsRecords(records, domain);
      }

      if (records.length === 0) {
         console.log(`⚠️ Geen bruikbare DNS-records voor ${domain}, wordt overgeslagen.`);
         continue;
      }

      fs.writeFileSync
         (`./output/${domain}.json`, JSON.stringify(records, null, 2), 'utf8');
      console.log(`✅ ${domain}.json is aangemaakt`);

      console.log(`📌 Migreren van ${records.length} DNS-records naar Openprovider voor ${domain}...`);
      await createOpenproviderZone(domain, records);
      console.log();
   }
}

// Start migratie
migrateDns();
