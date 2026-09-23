import { parseVariantInput } from "../src/lib/product-seller-product-payload"
import { parseBulkFromCsvBuffer } from "../src/lib/product-seller-bulk-import-parse"

async function runTests() {
  console.log("=== RUNNING DISCOUNT AS SELLING PRICE VERIFICATION TESTS ===")

  // Test 1: Standard case: Price 100, Discount 60 (entered selling price)
  const t1 = parseVariantInput({ name: "V1", price: 100, discount: 60, stock: 10 }, 0)
  if (!t1.ok) throw new Error("Test 1 failed to parse")
  console.log("Test 1 (Price 100, Discount 60):", {
    price: t1.variant.price,
    dbDiscount: t1.variant.discount,
    customerPays: t1.variant.price - t1.variant.discount
  })
  if (t1.variant.discount !== 40) throw new Error(`Test 1 expected dbDiscount 40, got ${t1.variant.discount}`)
  if (t1.variant.price - t1.variant.discount !== 60) throw new Error("Test 1 customer pays mismatch")

  // Test 2: Explicit sellingPrice field: Price 100, sellingPrice 60
  const t2 = parseVariantInput({ name: "V2", price: 100, sellingPrice: 60, stock: 10 }, 0)
  if (!t2.ok) throw new Error("Test 2 failed to parse")
  console.log("Test 2 (Price 100, sellingPrice 60):", {
    price: t2.variant.price,
    dbDiscount: t2.variant.discount,
    customerPays: t2.variant.price - t2.variant.discount
  })
  if (t2.variant.discount !== 40) throw new Error(`Test 2 expected dbDiscount 40, got ${t2.variant.discount}`)

  // Test 3: No discount: Price 100, Discount 0
  const t3 = parseVariantInput({ name: "V3", price: 100, discount: 0, stock: 10 }, 0)
  if (!t3.ok) throw new Error("Test 3 failed to parse")
  console.log("Test 3 (Price 100, Discount 0):", {
    price: t3.variant.price,
    dbDiscount: t3.variant.discount,
    customerPays: t3.variant.price - t3.variant.discount
  })
  if (t3.variant.discount !== 0) throw new Error(`Test 3 expected dbDiscount 0, got ${t3.variant.discount}`)
  if (t3.variant.price - t3.variant.discount !== 100) throw new Error("Test 3 customer pays mismatch")

  // Test 4: Equal price: Price 100, Discount 100 (selling at full price)
  const t4 = parseVariantInput({ name: "V4", price: 100, discount: 100, stock: 10 }, 0)
  if (!t4.ok) throw new Error("Test 4 failed to parse")
  console.log("Test 4 (Price 100, Discount 100):", {
    price: t4.variant.price,
    dbDiscount: t4.variant.discount,
    customerPays: t4.variant.price - t4.variant.discount
  })
  if (t4.variant.discount !== 0) throw new Error(`Test 4 expected dbDiscount 0, got ${t4.variant.discount}`)

  // Test 5: Validation error: Selling price 120 > Price 100
  const t5 = parseVariantInput({ name: "V5", price: 100, discount: 120, stock: 10 }, 0)
  console.log("Test 5 (Price 100, Discount 120):", t5.ok ? "UNEXPECTED PASS" : `EXPECTED ERROR: ${t5.error}`)
  if (t5.ok) throw new Error("Test 5 should have rejected selling price > regular price")

  // Test 6: Decimal values: Price 99.99, Selling Price 79.99
  const t6 = parseVariantInput({ name: "V6", price: 99.99, discount: 79.99, stock: 5 }, 0)
  if (!t6.ok) throw new Error("Test 6 failed to parse")
  console.log("Test 6 (Price 99.99, Discount 79.99):", {
    price: t6.variant.price,
    dbDiscount: t6.variant.discount,
    customerPays: t6.variant.price - t6.variant.discount
  })
  if (t6.variant.discount !== 20) throw new Error(`Test 6 expected dbDiscount 20, got ${t6.variant.discount}`)

  // Test 7: Bulk CSV parsing with selling_price alias
  const csvData = `category,product_name,variant_name,price,selling_price,stock\nElectronics,Phone,Black 128GB,500,450,15`
  const bulkRes = parseBulkFromCsvBuffer(Buffer.from(csvData, "utf8"))
  if (bulkRes.sheetErrors.length > 0) throw new Error(`Bulk CSV parsing errors: ${bulkRes.sheetErrors.join(", ")}`)
  console.log("Test 7 (Bulk CSV parsing with selling_price):", {
    cells: bulkRes.rows[0].cells
  })
  if (bulkRes.rows[0].cells.discount !== "450") {
    throw new Error(`Test 7 expected discount cell to be mapped to 450, got ${bulkRes.rows[0].cells.discount}`)
  }

  const bulkParsedVariant = parseVariantInput({
    name: bulkRes.rows[0].cells.variant_name,
    price: Number(bulkRes.rows[0].cells.price),
    discount: Number(bulkRes.rows[0].cells.discount),
    stock: Number(bulkRes.rows[0].cells.stock),
  }, 0)
  if (!bulkParsedVariant.ok) throw new Error("Bulk variant failed to parse")
  console.log("Test 7 Variant Output:", {
    price: bulkParsedVariant.variant.price,
    dbDiscount: bulkParsedVariant.variant.discount,
    customerPays: bulkParsedVariant.variant.price - bulkParsedVariant.variant.discount
  })
  if (bulkParsedVariant.variant.discount !== 50) throw new Error("Bulk variant discount calculation mismatch")

  console.log(">>> ALL 7 TESTS PASSED SUCCESSFULLY! Mathematical consistency verified.")
}

runTests().catch((err) => {
  console.error("Test failed with error:", err)
  process.exit(1)
})
