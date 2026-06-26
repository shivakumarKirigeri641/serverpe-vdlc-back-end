/**
 * Builds an invoice id of the form <prefix><ddmmyyyy><NNNN> where NNNN is the
 * per-day sequential counter (resets each day). The day is encoded into the id
 * itself, so the counter is derived by matching existing ids for today.
 *
 * Runs on the caller's client so it participates in the surrounding transaction
 * (the invoices.invoice_id UNIQUE constraint is the final guard against races).
 *
 * @param {import("pg").PoolClient} client active pg client (inside a transaction)
 * @param {string} prefix business_details.invoice_prefix (e.g. "INVVDLC")
 * @returns {Promise<string>}
 */
const generateInvoiceId = async (client, prefix) => {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const datePart = `${dd}${mm}${yyyy}`;

  const likePattern = `${prefix}${datePart}%`;
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS count FROM invoices WHERE invoice_id LIKE $1`,
    [likePattern]
  );

  const seq = String(rows[0].count + 1).padStart(4, "0");
  return `${prefix}${datePart}${seq}`;
};

module.exports = generateInvoiceId;
