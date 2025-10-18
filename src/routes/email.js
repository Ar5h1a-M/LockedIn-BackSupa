// src/routes/email.js
import express from "express";
import fetch from 'node-fetch';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     EmailRequest:
 *       type: object
 *       required:
 *         - to
 *         - subject
 *         - message
 *       properties:
 *         to:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         subject:
 *           type: string
 *           example: "Welcome to Our Service"
 *         message:
 *           type: string
 *           example: "Hello, welcome to our platform!"
 *         recipient_name:
 *           type: string
 *           example: "John Doe"
 *         from_name:
 *           type: string
 *           example: "LockedIn Team"
 *         action_url:
 *           type: string
 *           example: "https://lockedin-wits.vercel.app"
 *         support_url:
 *           type: string
 *           example: "https://lockedin-wits.vercel.app/support"
 *     EmailResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Email sent successfully"
 *         to:
 *           type: string
 *           example: "user@example.com"
 *         subject:
 *           type: string
 *           example: "Welcome to Our Service"
 *         service:
 *           type: string
 *           example: "emailjs"
 *         note:
 *           type: string
 *           example: "Sent using invitation template layout"
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Missing required fields"
 */

// Email service setup
let emailService;

if (process.env.NODE_ENV === "test") {
  console.log("Test environment: Email functionality disabled");
  emailService = {
    sendEmail: async (to, subject, html, text, templateData = {}) => {
      console.log("[Mock email] sendEmail called to:", to);
      return Promise.resolve({ 
        success: true,
        to: to,
        subject: subject,
        service: "emailjs",
        message: "Email sent successfully (mock)"
      });
    }
  };
} else {
  // Production: Use existing invitation template with dynamic content
  emailService = {
    sendEmail: async (to, subject, html, text, templateData = {}) => {
      try {
        console.log(`📧 Sending email to: ${to}`);

        if (!process.env.EMAILJS_SERVICE_ID || !process.env.EMAILJS_USER_ID || !process.env.EMAILJS_INVITATION_TEMPLATE_ID) {
          console.error('❌ Missing EmailJS environment variables');
          return { 
            error: 'EmailJS configuration incomplete - check environment variables',
            success: false
          };
        }

        // Use the existing invitation template but make everything dynamic
        const templateParams = {
          name: templateData.recipient_name || to.split('@')[0],
          topic: templateData.topic || 'Race info',
          session_time: templateData.session_time || '',
          venue: templateData.venue || '',
          time_goal: templateData.time_goal || '',
          content_goal: templateData.content_goal || '',
          organizer: 'RaceIQ Team',
          action_url: 'https://race-iq.vercel.app',
          support_url:  'https://race-iq.vercel.app',
          email: to
        };

        console.log(`📤 Sending email using invitation template`);

        // FIX: Add proper headers to bypass browser-only restriction
        const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Origin': 'https://lockedin-wits.vercel.app',
          },
          body: JSON.stringify({
            service_id: process.env.EMAILJS_SERVICE_ID,
            template_id: process.env.EMAILJS_INVITATION_TEMPLATE_ID, // Use existing template
            user_id: process.env.EMAILJS_USER_ID,
            template_params: templateParams
          })
        });

        const responseText = await emailjsResponse.text();
        
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (parseError) {
          if (responseText === 'OK' || responseText.trim() === 'OK') {
            result = { status: 'success', message: 'Email sent successfully' };
          } else {
            throw new Error(`EmailJS returned: ${responseText}`);
          }
        }

        if (!emailjsResponse.ok) {
          throw new Error(`EmailJS API error: ${emailjsResponse.status} - ${JSON.stringify(result)}`);
        }

        console.log(`✅ Email sent successfully to: ${to}`);
        return { 
          success: true, 
          service: 'emailjs',
          response: result
        };
        
      } catch (error) {
        console.error(`❌ Failed to send email to ${to}:`, error.message);
        return { 
          success: false,
          error: `Email service failed: ${error.message}`
        };
      }
    }
  };
}

// Safe email function
async function sendEmailSafe(to, subject, html, text, templateData = {}) {
  return await emailService.sendEmail(to, subject, html, text, templateData);
}



// Export for potential reuse
export { emailService, sendEmailSafe };

/**
 * @openapi
 * /api/email/health:
 *   get:
 *     summary: Check email service health
 *     tags: [Email]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 service:
 *                   type: string
 *                   example: "Email API"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    service: "Email API",
    timestamp: new Date().toISOString()
  });
});

/**
 * @openapi
 * /api/email/send:
 *   post:
 *     summary: Send an email using LockedIn's email service
 *     description: Public API endpoint for external teams to send emails. Uses existing invitation template layout.
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRequest'
 *     responses:
 *       200:
 *         description: Email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailResponse'
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/send", async (req, res) => {
  try {
    const { to, subject, message, recipient_name, from_name, action_url, support_url, ...otherParams } = req.body;

    // Validate required fields
    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: to, subject, message"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email address format"
      });
    }

    console.log(`📧 Public API: Sending email to ${to}`);

    const templateData = {
      recipient_name: recipient_name || to.split('@')[0],
      subject: subject,
      message: message,
      from_name: from_name || 'LockedIn Team',
      action_url: action_url || 'https://lockedin-wits.vercel.app',
      support_url: support_url || 'https://lockedin-wits.vercel.app/support',
      ...otherParams
    };

    const result = await sendEmailSafe(to, subject, message, message, templateData);

    if (result.success) {
      res.json({
        success: true,
        message: "Email sent successfully",
        to: to,
        subject: subject,
        service: result.service,
        note: "Sent using invitation template layout"
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to send email",
        to: to
      });
    }

  } catch (error) {
    console.error('❌ Email sending failed:', error);
    res.status(500).json({
      success: false,
      error: "Internal server error while sending email"
    });
  }
});

/**
 * @openapi
 * /api/email/test:
 *   post:
 *     summary: Test email sending functionality
 *     description: Send a test email to verify the service is working
 *     tags: [Email]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               to:
 *                 type: string
 *                 format: email
 *                 example: "test@example.com"
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EmailResponse'
 *       500:
 *         description: Failed to send test email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/test", async (req, res) => {
  try {
    const testEmail = req.body.to || 'njam.arshia@gmail.com';
    
    const result = await sendEmailSafe(
      testEmail,
      'Test Email from LockedIn Public API',
      'This is a test email sent through the public API endpoint.',
      'This is a test email sent through the public API endpoint.',
      {
        recipient_name: "Test User",
        from_name: "LockedIn API",
        message: "This email confirms that the public email API is working correctly. The message content appears in the 'content_goal' section of the invitation template."
      }
    );

    if (result.success) {
      res.json({
        success: true,
        message: "Test email sent successfully",
        to: testEmail,
        note: "Uses invitation template layout"
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to send test email"
      });
    }

  } catch (error) {
    console.error('❌ Test email failed:', error);
    res.status(500).json({
      success: false,
      error: "Internal server error while sending test email"
    });
  }
});

// In your email.js file, update the /emailJS-test endpoint:

/**
 * @openapi
 * /api/email/emailJS-test:
 *   get:
 *     summary: Test EmailJS integration with invitation template
 *     description: Send a test email using the invitation template with query parameters
 *     tags: [Email]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: Recipient email address
 *         example: "njam.arshia@gmail.com"
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Type of test (shows in subject)
 *         example: "invitation"
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "invitation test email sent to test@example.com"
 *                 to:
 *                   type: string
 *                   example: "test@example.com"
 *                 type:
 *                   type: string
 *                   example: "invitation"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to send test email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/emailJS-test", async (req, res) => {
  try {
    const testEmail = req.query.email || 'njam.arshia@gmail.com';
    const testType = req.query.type || 'invitation';
    
    console.log(`🧪 Testing EmailJS ${testType} template to: ${testEmail}`);

    // Use the same template parameter structure as your main email.js
    const templateParams = {
      name: "Test User",
      topic: `${testType.charAt(0).toUpperCase() + testType.slice(1)} Test from LockedIn`,
      session_time: new Date().toLocaleString(),
      venue: "LockedIn Platform",
      time_goal: "60 minutes",
      content_goal: `This is a test ${testType} email to verify EmailJS integration with the invitation template.`,
      organizer: "LockedIn Team",
      action_url: "https://lockedin-wits.vercel.app",
      support_url: "https://lockedin-wits.vercel.app/support",
      email: testEmail
    };

    console.log(`📤 Sending ${testType} test email with invitation template`);

    // FIX: Use the emailService in test environment, direct EmailJS call in production
    if (process.env.NODE_ENV === "test") {
      console.log("📧 Using mock email service for testing");
      const result = await sendEmailSafe(
        testEmail,
        `${testType.charAt(0).toUpperCase() + testType.slice(1)} Test from LockedIn`,
        `This is a test ${testType} email to verify EmailJS integration with the invitation template.`,
        `This is a test ${testType} email to verify EmailJS integration with the invitation template.`,
        templateParams
      );

      if (result.success) {
        res.json({ 
          success: true, 
          message: `${testType} test email sent to ${testEmail}`,
          to: testEmail,
          type: testType,
          service: 'emailjs',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: `Test failed: ${result.error}`
        });
      }
    } else {
      // Production: Direct EmailJS call with proper headers
      const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://lockedin-wits.vercel.app',
        },
        body: JSON.stringify({
          service_id: process.env.EMAILJS_SERVICE_ID,
          template_id: process.env.EMAILJS_INVITATION_TEMPLATE_ID, // Always use invitation template
          user_id: process.env.EMAILJS_USER_ID,
          template_params: templateParams
        })
      });

      // Use the same response handling as your main email service
      const responseText = await emailjsResponse.text();
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        if (responseText === 'OK' || responseText.trim() === 'OK') {
          result = { status: 'success', message: 'Email sent successfully' };
        } else {
          throw new Error(`EmailJS returned: ${responseText}`);
        }
      }

      if (!emailjsResponse.ok) {
        throw new Error(`EmailJS API error: ${emailjsResponse.status} - ${JSON.stringify(result)}`);
      }

      console.log(`✅ ${testType} test email sent successfully to: ${testEmail}`);
      
      res.json({ 
        success: true, 
        message: `${testType} test email sent to ${testEmail}`,
        to: testEmail,
        type: testType,
        service: 'emailjs',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ EmailJS test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: `Test failed: ${error.message}`
    });
  }
});

export default router;