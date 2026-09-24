import * as fs from "fs";
import * as path from "path";

const auditData = JSON.parse(fs.readFileSync("scratch/test-sellers-final-audit.json", "utf8"));
const realSellers = auditData.realSellers;
const testSellers = auditData.testSellers;

function formatSellerName(s: any): string {
  const userName = (s.name || "").trim();
  const storeName = (s.storeOrBizName && s.storeOrBizName !== "(None)") ? s.storeOrBizName.trim() : "";
  
  if (userName && storeName && userName.toLowerCase() !== storeName.toLowerCase()) {
    return `${userName} [Store: ${storeName}]`;
  }
  return userName || storeName || "N/A";
}

function formatPhone(s: any): string {
  return (s.phone && s.phone !== "(None)") ? s.phone.trim() : "N/A";
}

function formatEmail(s: any): string {
  return (s.email && s.email !== "(No Email)") ? s.email.trim() : "N/A";
}

let doc = "";
doc += "================================================================================\n";
doc += "                MEEEM MULTI-VENDOR: REAL & TEST SELLERS LIST\n";
doc += "================================================================================\n";
doc += `Generated On: 2026-09-24\n`;
doc += `Total Sellers: 241\n`;
doc += ` - Real Sellers Count: ${realSellers.length}\n`;
doc += ` - Test Sellers Count: ${testSellers.length}\n`;
doc += "================================================================================\n\n";

// --- PART 1: REAL SELLERS ---
doc += "================================================================================\n";
doc += `PART 1: REAL SELLERS (${realSellers.length} Sellers)\n`;
doc += "================================================================================\n\n";

realSellers.forEach((s: any, idx: number) => {
  const num = (idx + 1).toString().padStart(3, " ");
  doc += `${num}. Name:   ${formatSellerName(s)}\n`;
  doc += `     Mobile: ${formatPhone(s)}\n`;
  doc += `     Email:  ${formatEmail(s)}\n\n`;
});

// --- PART 2: TEST SELLERS ---
doc += "\n================================================================================\n";
doc += `PART 2: TEST / FAKE / DEMO SELLERS (${testSellers.length} Sellers)\n`;
doc += "================================================================================\n\n";

testSellers.forEach((s: any, idx: number) => {
  const num = (idx + 1).toString().padStart(3, " ");
  doc += `${num}. Name:   ${formatSellerName(s)}\n`;
  doc += `     Mobile: ${formatPhone(s)}\n`;
  doc += `     Email:  ${formatEmail(s)}\n\n`;
});

const outputPath = path.join("txt", "TEST_AND_REAL_SELLERS_LIST.txt");
fs.writeFileSync(outputPath, doc, "utf8");
console.log(`Document successfully generated at: ${outputPath}`);
