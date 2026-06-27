// Columns inserted into challan_details, in order (see serverpe_vdlc.sql).
const CHALLAN_COLUMNS = [
  "fk_rc_details",
  "challan_no",
  "challan_for",
  "accused_type",
  "violator_name",
  "violator_father_name",
  "violator_contact_no",
  "challan_date",
  "offence",
  "penalty",
  "challan_amount",
  "status",
  "challan_location",
  "payment_source",
  "payment_date",
  "transaction_id",
  "receipt_no",
  "owner_name",
  "court_status",
  "rto_name",
  "api_response",
];

const INSERT_CHALLAN = `INSERT INTO challan_details (${CHALLAN_COLUMNS.join(", ")})
  VALUES (${CHALLAN_COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})`;

/**
 * Inserts the given challan rows for a vehicle, if none exist yet for that
 * rc_details (idempotent). Runs on the caller's transaction client.
 *
 * @param {import("pg").PoolClient} client
 * @param {Array<object>} challans  rows whose keys cover CHALLAN_COLUMNS
 */
const insertChallanDetails = async (client, challans) => {
  const rows = Array.isArray(challans) ? challans : [];
  if (rows.length === 0) return;

  const fk = rows[0].fk_rc_details;
  const existing = await client.query(
    `SELECT 1 FROM challan_details WHERE fk_rc_details = $1 LIMIT 1`,
    [fk]
  );
  if (existing.rows.length > 0) return;

  for (const challan of rows) {
    const values = CHALLAN_COLUMNS.map((col) => challan[col]);
    await client.query(INSERT_CHALLAN, values);
  }
};

module.exports = insertChallanDetails;
