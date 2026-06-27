// Columns inserted into fastag_details, in order (see serverpe_vdlc.sql).
const FASTAG_COLUMNS = [
  "fk_rc_details",
  "vehicle_number",
  "fastag_id",
  "bank_name",
  "customer_name",
  "balance",
  "status",
  "issued_date",
  "api_response",
];

const INSERT_FASTAG = `INSERT INTO fastag_details (${FASTAG_COLUMNS.join(", ")})
  VALUES (${FASTAG_COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})`;

/**
 * Inserts a FASTag row for a vehicle, if none exists yet for that rc_details
 * (idempotent). Runs on the caller's transaction client.
 *
 * @param {import("pg").PoolClient} client
 * @param {object} fastag  row whose keys cover FASTAG_COLUMNS
 */
const insertFastagDetails = async (client, fastag) => {
  if (!fastag || fastag.fk_rc_details == null) return;

  const existing = await client.query(
    `SELECT 1 FROM fastag_details WHERE fk_rc_details = $1 LIMIT 1`,
    [fastag.fk_rc_details]
  );
  if (existing.rows.length > 0) return;

  const values = FASTAG_COLUMNS.map((col) => fastag[col]);
  await client.query(INSERT_FASTAG, values);
};

module.exports = insertFastagDetails;
