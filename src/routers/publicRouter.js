const express = require(`express`);
const getStatesAndUnions = require("../repos/gets/getStatesAndUnions");
const getSubscriptionDetails = require("../repos/gets/getSubscriptionDetails");
const validateSendOtp = require("../validators/validateSendOtp");
const sendOtp = require("../repos/insertions/sendOtp");
const validateForMobileNumberandOtp=require('../validators/validateForMobileNumberandOtp')
const verifyOtp = require("../repos/insertions/verifyOtp");
const validateForMobileNumber = require("../validators/validateMoibleNumber");
const getDetails = require("../repos/gets/getDetails");
const validateForMobileNumberVehicle = require("../validators/validateForMobileNumberVehicle");
const activateTrialPlan = require("../repos/insertions/activateTrialPlan");
const validateForMobileNumberPlan = require("../validators/validateForMobileNumberPlan");
const createOrder = require("../repos/insertions/createOrder");
const validateVerifyPayment = require("../validators/validateVerifyPayment");
const verifyPayment = require("../repos/insertions/verifyPayment");
const getFeedbacks = require("../repos/gets/getFeedbacks");
const getQueryTypes = require("../repos/gets/getQueryTypes");
const validateFeedback = require("../validators/validateFeedback");
const submitFeedback = require("../repos/insertions/submitFeedback");
const validateContact = require("../validators/validateContact");
const submitContact = require("../repos/insertions/submitContact");
const getStaticPage = require("../repos/gets/getStaticPage");
const getBusinessDetails = require("../repos/gets/getBusinessDetails");
const publicRouter = express.Router();
publicRouter.get('/states-unions', async(req, res)=>{
    try {
    const result = await getStatesAndUnions();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.get('/feedbacks', async(req, res)=>{
    try {
    const result = await getFeedbacks();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.get('/query-types', async(req, res)=>{
    try {
    const result = await getQueryTypes();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.get('/subscription-details', async(req, res)=>{
    try {
    const result = await getSubscriptionDetails();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.post('/send-otp', async(req, res)=>{
    try {
      const validate=validateSendOtp(req);
      if(false === validate.successstatus){
          return res.status(validate.statuscode).json({
              statuscode: validate.statuscode,
              powered_by: "ServerPe App Solutions",
              successstatus: validate.successstatus,
              message: validate.message,
          });
      }
      const result = await sendOtp(validate.data);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.post('/verify-otp', async(req, res)=>{
  try {
    let validatemobileotp=validateForMobileNumberandOtp(req);
    if(false === validatemobileotp.successstatus){
        return res.status(validatemobileotp.statuscode).json({
            statuscode: validatemobileotp.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validatemobileotp.successstatus,
            message: validatemobileotp.message,
        });
    }
    const result = await verifyOtp(validatemobileotp.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
publicRouter.post('/activate-trial-plan', async(req, res)=>{
  try {
    const validate=validateForMobileNumberVehicle(req);
    if(false === validate.successstatus){
        return res.status(validate.statuscode).json({
            statuscode: validate.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validate.successstatus,
            message: validate.message,
        });
    }
    const result = await activateTrialPlan(validate.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
publicRouter.post('/create-order', async(req, res)=>{
  try {
    const validate=validateForMobileNumberPlan(req);
    if(false === validate.successstatus){
        return res.status(validate.statuscode).json({
            statuscode: validate.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validate.successstatus,
            message: validate.message,
        });
    }
    const result = await createOrder(validate.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
publicRouter.post('/verify-payment', async(req, res)=>{
  try {
    const validate=validateVerifyPayment(req);
    if(false === validate.successstatus){
        return res.status(validate.statuscode).json({
            statuscode: validate.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validate.successstatus,
            message: validate.message,
        });
    }
    const result = await verifyPayment(validate.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
publicRouter.post('/contact-me', async(req, res)=>{
  try {
    const validate=validateContact(req);
    if(false === validate.successstatus){
        return res.status(validate.statuscode).json({
            statuscode: validate.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validate.successstatus,
            message: validate.message,
        });
    }
    const result = await submitContact(validate.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
publicRouter.post('/feedback', async(req, res)=>{
  try {
    const validate=validateFeedback(req);
    if(false === validate.successstatus){
        return res.status(validate.statuscode).json({
            statuscode: validate.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validate.successstatus,
            message: validate.message,
        });
    }
    const result = await submitFeedback(validate.data);
  return res.status(result.statuscode).json({
    statuscode: result.statuscode,
    powered_by: "ServerPe App Solutions",
    successstatus: result.successstatus,
    message: result.message,
    data: result.data,
  });
} catch (err) {
  return res.status(500).json({
    statuscode: 500,
    powered_by: "ServerPe App Solutions",
    successstatus: false,
    message: `Internal server error. Error:${err.message}`,
  });
} finally {
}
});
publicRouter.post('/get-details', async(req, res)=>{
  try {
    const validate=validateForMobileNumber(req);
    if(false === validate.successstatus){
        return res.status(validate.statuscode).json({
            statuscode: validate.statuscode,
            powered_by: "ServerPe App Solutions",
            successstatus: validate.successstatus,
            message: validate.message,
        });
    }
    const result = await getDetails(validate.data.mobile_number);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.get('/business-details', async(req, res)=>{
  try {
    const result = await getBusinessDetails();
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
publicRouter.get('/static-page/:page_code', async(req, res)=>{
  try {
    const result = await getStaticPage(req.params.page_code);
    return res.status(result.statuscode).json({
      statuscode: result.statuscode,
      powered_by: "ServerPe App Solutions",
      successstatus: result.successstatus,
      message: result.message,
      data: result.data,
    });
  } catch (err) {
    return res.status(500).json({
      statuscode: 500,
      powered_by: "ServerPe App Solutions",
      successstatus: false,
      message: `Internal server error. Error:${err.message}`,
    });
  } finally {
  }
});
module.exports=publicRouter;