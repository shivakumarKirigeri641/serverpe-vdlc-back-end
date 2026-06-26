const { connectDB } = require("../../database/connectDB");

const getStatesAndUnions=async()=>{
try {
  const pool = connectDB();
  // Fetch only active states/UTs, alphabetically, for the frontend dropdown.
  const query = `
    SELECT id, state_name, state_code
    FROM states_unions
    WHERE is_active = true
    ORDER BY state_name ASC
  `;
  const { rows } = await pool.query(query);

  if (rows.length === 0) {
    return {
      statuscode: 404,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: "No states or union territories found.",
      data: [],
    };
  }

  return {
    statuscode: 200,
    powered_by: "ServerPe App Solutions",
    successstatus: true,
    message: "States and union territories fetched successfully.",
    data: rows,
  };
}catch(err){
 return {
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
    data: {},
  };
}
};module.exports=getStatesAndUnions;