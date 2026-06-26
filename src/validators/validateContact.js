const validateForMobileNumber = require("./validateMoibleNumber");

// Basic email shape check (only validated when an email is provided).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the /contact-me request body, e.g.
 * {
 *   "query_type_id": 1, "user_name": "Ravi", "mobile_number": "9886122415",
 *   "email": "ravi@example.com", "message": "Need help with my report"
 * }
 *
 * Returns normalized { query_type_id, user_name, mobile_number, email, message }.
 */
const validateContact = (req) => {
  try {
    const mobileResult = validateForMobileNumber(req);
    if (false === mobileResult.successstatus) {
      return mobileResult;
    }

    const rawQueryTypeId =
      req?.body?.query_type_id ?? req?.body?.fk_query_types;
    const query_type_id = Number(rawQueryTypeId);
    if (
      rawQueryTypeId === undefined ||
      rawQueryTypeId === null ||
      rawQueryTypeId === "" ||
      !Number.isInteger(query_type_id) ||
      query_type_id <= 0
    ) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "query_type_id is required and must be a positive integer",
        data: null,
      };
    }

    const user_name = (req?.body?.user_name || "").toString().trim();
    if (!user_name) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "user_name is required",
        data: null,
      };
    }

    const message = (req?.body?.message || "").toString().trim();
    if (!message) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "message is required",
        data: null,
      };
    }

    const email = (req?.body?.email || "").toString().trim();
    if (email && !EMAIL_REGEX.test(email)) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "Invalid email format",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Contact request validated successfully",
      data: {
        query_type_id,
        user_name,
        mobile_number: mobileResult.data.mobile_number,
        email: email || null,
        message,
      },
    };
  } catch (error) {
    console.error("Contact validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateContact;
