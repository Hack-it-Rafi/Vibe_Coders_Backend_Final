const express = require("express");
const router = express.Router();

// Agent proxy route to avoid CORS
router.post("/chat", async (req, res) => {
  try {
    const { message, sessionId, context, agentId } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const AGENT_API_URL = "https://cmfy9so1f663u2py5v2lkqba8.agent.a.smyth.ai";

    console.log("Sending request to agent API:", {
      url: AGENT_API_URL,
      payload: { message, sessionId, context, agentId },
    });

    const response = await fetch(AGENT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        message,
        sessionId,
        context: context || "",
        agentId,
      }),
    });

    console.log("Agent API response status:", response.status);
    console.log(
      "Agent API response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      // Get the response text for better error details
      const errorText = await response.text();
      console.error("Agent API error response:", errorText);

      throw new Error(
        `Agent API responded with status: ${response.status} - ${response.statusText}. Response: ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Agent API success response:", data);
    res.json(data);
  } catch (error) {
    console.error("Error communicating with agent API:", error);

    // More detailed error response
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      res.status(503).json({
        error: "Network error - Unable to reach agent API",
        message: error.message,
        details: "Check if the agent API is accessible",
      });
    } else if (error.message.includes("Agent API responded with status")) {
      res.status(502).json({
        error: "Agent API error",
        message: error.message,
      });
    } else {
      res.status(500).json({
        error: "Failed to communicate with agent",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      });
    }
  }
});

module.exports = router;
