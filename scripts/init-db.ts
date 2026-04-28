import { getDb, listTemplates } from "../lib/db";

getDb();
const templates = listTemplates();
console.log(`database initialized with ${templates.length} template(s)`);
