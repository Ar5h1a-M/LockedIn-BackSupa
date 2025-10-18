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
 *           example: "Study Session Invitation"
 *         message:
 *           type: string
 *           example: "You're invited to join our study session"
 *         recipient_name:
 *           type: string
 *           example: "John Doe"
 *         topic:
 *           type: string
 *           example: "Mathematics Study Group"
 *         session_time:
 *           type: string
 *           example: "2024-01-20 14:00"
 *         venue:
 *           type: string
 *           example: "Library Room 301"
 *         time_goal:
 *           type: string
 *           example: "120 minutes"
 *         content_goal:
 *           type: string
 *           example: "Complete calculus chapter 5 exercises"
 *         organizer:
 *           type: string
 *           example: "Math Department"
 *         # Note: action_url and support_url are now fixed to RaceIQ URLs
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
 *           example: "Study Session Invitation"
 *         service:
 *           type: string
 *           example: "emailjs"
 *         template_params:
 *           type: object
 *           description: "The actual template parameters sent to EmailJS"
 *           example:
 *             name: "John Doe"
 *             topic: "Mathematics Study Group"
 *             session_time: "2024-01-20 14:00"
 *             venue: "Library Room 301"
 *             time_goal: "120 minutes"
 *             content_goal: "Complete calculus chapter 5 exercises"
 *             organizer: "Race IQ Team"
 *             action_url: "https://race-iq.vercel.app"
 *             support_url: "https://race-iq.vercel.app"
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
 *         template_params:
 *           type: object
 *           description: "Template parameters that were attempted"
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
          name: templateData.name || to.split('@')[0],
          topic: templateData.topic || subject || 'Message from LockedIn',
          session_time: templateData.session_time ||'',
          venue: templateData.venue || 'LockedIn Team',
          time_goal: templateData.time_goal || '',
          content_goal: templateData.content_goal ||'',
          organizer: 'Race IQ Team',
          action_url: 'https://race-iq.vercel.app',
          support_url: 'https://race-iq.vercel.app',
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
 *     summary: Send an email using RaceIQ's invitation template
 *     description: |
 *       Public API endpoint for external teams to send emails using the RaceIQ invitation template layout.
 *       All dynamic template parameters are supported and will be mapped to the EmailJS template variables.
 *       
 *       **Fixed URLs**: action_url and support_url are now fixed to RaceIQ URLs for consistency.
 *       
 *       **Template Mapping**:
 *       - `recipient_name` → `name` in template
 *       - `topic` or `subject` → `topic` in template  
 *       - `content_goal` or `message` → `content_goal` in template
 *       - Additional parameters are passed directly to template
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailRequest'
 *           examples:
 *             studySession:
 *               summary: Study Session Invitation
 *               value:
 *                 to: "student@example.com"
 *                 subject: "Study Session Invitation"
 *                 message: "General invitation message"
 *                 recipient_name: "Jane Smith"
 *                 topic: "Physics Study Group"
 *                 session_time: "2024-01-20 15:00"
 *                 venue: "Science Building Room 205"
 *                 time_goal: "90 minutes"
 *                 content_goal: "Complete quantum mechanics problem set"
 *                 organizer: "Physics Club"
 *             minimal:
 *               summary: Minimal Required Fields
 *               value:
 *                 to: "user@example.com"
 *                 subject: "Test Email"
 *                 message: "This is a test message"
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
    const { 
      to, 
      subject, 
      message, 
      recipient_name, 
      from_name, 
      action_url, 
      support_url,
      // Template-specific parameters that match your EmailJS template
      topic,
      session_time, 
      venue, 
      time_goal, 
      content_goal,
      organizer,
      // Catch all other dynamic parameters
      ...otherParams 
    } = req.body;

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

    // Use the same template parameter structure as emailJS-test
    const templateParams = {
      name: recipient_name || to.split('@')[0],
      topic: topic || subject, // Use topic if provided, otherwise fall back to subject
      session_time: session_time || '',
      venue: venue || '',
      time_goal: time_goal || '',
      content_goal: content_goal || message, // Use message as content_goal if not provided
      organizer:  'Race IQ Team',
      action_url:  'https://race-iq.vercel.app',
      support_url:  'https://race-iq.vercel.app',
      email: to,
      // Include any additional dynamic parameters from other teams
      ...otherParams
    };

    console.log(`📤 Sending email using invitation template with params:`, templateParams);

    const result = await sendEmailSafe(to, subject, message, message, templateParams);

    if (result.success) {
      res.json({
        success: true,
        message: "Email sent successfully",
        to: to,
        subject: subject,
        service: result.service,
        template_params: templateParams, // Return the template params for debugging
        note: "Sent using invitation template layout"
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || "Failed to send email",
        to: to,
        template_params: templateParams // Include template params in error for debugging
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