/**
 * Validates the /feedback request body, e.g.
 * { "user_name": "Ravi", "ratings": 5, "comments": "Great service!" }
 *
 * Returns normalized { user_name, ratings, comments } on success.
 */
const validateFeedback = (req) => {
  try {
    const user_name = (req?.body?.user_name || "").toString().trim();
    const comments = (req?.body?.comments || "").toString().trim();
    const ratings = Number(req?.body?.ratings);

    if (!user_name) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "user_name is required",
        data: null,
      };
    }

    if (
      !Number.isInteger(ratings) ||
      ratings < 1 ||
      ratings > 5
    ) {
      return {
        statuscode: 400,
        successstatus: false,
        powered_by: "ServerPe App Solutions",
        message: "ratings is required and must be an integer between 1 and 5",
        data: null,
      };
    }

    return {
      statuscode: 200,
      successstatus: true,
      powered_by: "ServerPe App Solutions",
      message: "Feedback validated successfully",
      data: {
        user_name,
        ratings,
        comments: comments || null,
      },
    };
  } catch (error) {
    console.error("Feedback validation error:", error);
    return {
      statuscode: 500,
      successstatus: false,
      powered_by: "ServerPe App Solutions",
      message: "Internal server error",
      data: null,
    };
  }
};

module.exports = validateFeedback;
