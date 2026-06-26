// Columns inserted into rc_details, in order (see serverpe_vdlc.sql). fk_user,
// id, is_active and the timestamps are intentionally omitted (defaults / not used).
const RC_COLUMNS = [
  "reg_no",
  "vehicle_class",
  "chassis",
  "engine",
  "vehicle_manufacturer_name",
  "model",
  "vehicle_colour",
  "vehicle_type",
  "norms_type",
  "body_type",
  "owner_count",
  "owner_name",
  "owner_father_name",
  "mobile_number",
  "status",
  "status_as_on",
  "reg_authority",
  "reg_date",
  "vehicle_manufacturing_month_year",
  "rc_expiry_date",
  "vehicle_tax_upto",
  "vehicle_insurance_company_name",
  "vehicle_insurance_upto",
  "vehicle_insurance_policy_number",
  "rc_financer",
  "present_address",
  "permanent_address",
  "vehicle_cubic_capacity",
  "gross_vehicle_weight",
  "unladen_weight",
  "vehicle_category",
  "rc_standard_cap",
  "vehicle_cylinders_no",
  "vehicle_seat_capacity",
  "vehicle_sleeper_capacity",
  "vehicle_standing_capacity",
  "wheelbase",
  "pucc_number",
  "pucc_upto",
  "blacklist_status",
  "blacklist_details",
  "challan_details",
  "fastag_details",
  "permit_issue_date",
  "permit_number",
  "permit_type",
  "permit_valid_from",
  "permit_valid_upto",
  "non_use_status",
  "non_use_from",
  "non_use_to",
  "national_permit_number",
  "national_permit_upto",
  "national_permit_issued_by",
  "is_commercial",
  "noc_details",
  "rto_code",
  "financed",
  "api_response",
];

const INSERT_RC_DETAILS = `INSERT INTO rc_details (${RC_COLUMNS.join(", ")})
  VALUES (${RC_COLUMNS.map((_, i) => `$${i + 1}`).join(", ")})
  RETURNING id, reg_no`;

/**
 * Inserts an rc_details row for the given vehicle if one doesn't already exist
 * (keyed by reg_no). Runs on the caller-provided client so it participates in
 * the surrounding transaction.
 *
 * @param {import("pg").PoolClient} client active pg client (inside a transaction)
 * @param {Object} rcData record whose keys cover RC_COLUMNS (see temp/getRandomRCData.js)
 * @returns {Promise<import("pg").QueryResult>} the existing or newly inserted row
 */
const insertRCDetails = async (client, rcData) => {
  const existing = await client.query(
    `SELECT id, reg_no FROM rc_details WHERE reg_no = $1`,
    [rcData.reg_no]
  );
  if (existing.rows.length > 0) {
    return existing;
  }

  const values = RC_COLUMNS.map((col) => rcData[col]);
  return client.query(INSERT_RC_DETAILS, values);
};

module.exports = insertRCDetails;
