import OpenAI from "openai";
import express from "express";
import { default as API_KEYS } from "../api-keys.json" with { type: "json" };


const app = express();
app.use(express.static("www"));
app.use(express.json()) // for parsing req.body when mine type is application/json

// Utils

async function convertImageToBase64(url) {
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString('base64');
}

async function postRequest(endpoint, apiKey, params) {
  console.log('postRequest', endpoint, apiKey, JSON.stringify(params))
  const response = await fetch(endpoint, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(params)
  })

  return await response.json();
}

// Endpoints

app.post("/image/generate", async (req, res) => {
  const prompt = req.body.system ? `${req.body.system}. Draw the following: ${req.body.prompt}` : req.body.prompt;
  console.log({prompt})
  let response;
  switch (req.body.model) {
    case 'openjourney':
      response = await postRequest(
        "https://api.runpod.ai/v2/sd-openjourney/runsync",
        API_KEYS.RUNPOD,
        {
          input: {
            prompt,
            height: 512,
            width: 512,
            num_outputs: 1    // Stable Diffusion v2 & Anything v4 use the same argument name, Stable Diffusion XL & Kandinsky name it num_images
          }
        }
      )
      console.log('received', response)
      res.json({
        error: response.status === "COMPLETED" ? "" : response.status,
        url: response.output[0].image
      })
      break;
    case 'dalle3':
      response = await postRequest(
        "https://api.openai.com/v1/images/generations",
        API_KEYS.OPENAI,
        {
          model: "dall-e-3",
          quality: "standard",   // $0.04 / image
          size: "1024x1024",
          style: "vivid",
          response_format: "url", // valid for 60min only
          prompt
        }
      )
      console.log('received', response);
      res.json({
        error: "",
        url: response.data[0].url
      })
      break;
  }
});

app.post("/image/describe", async (req, res) => {
  let response;

  switch (req.body.model) {
    case 'llava':
      const image = await convertImageToBase64(req.body.url);
      // Ollama
      response = await postRequest("http://localhost:11434/api/generate", "no-api-key", {
        "model": "llava",
        "prompt": `${req.body.system}. ${req.body.prompt}`,
        "images": [image],
        "stream": false
      })
      console.log('received', response)
      res.json({
        error: response.error ?? "",
        desc: response.response
      })
      break;
    case 'gpt4v':
      response = await postRequest(
        "https://api.openai.com/v1/chat/completions",
        API_KEYS.OPENAI,
        {
          model: "gpt-4-vision-preview",
          messages: [
            { role: "system", content: req.body.system },
            { role: "user", content: [
              { type: "text", text: req.body.prompt },
              { type: "image_url", image_url: req.body.url }
            ]}
          ]
        }
      )
      console.log('received', response);
      res.json({
        error: response.choices[0].finish_reason === "stop" ? "" : response.choices[0].finish_reason,
        desc: response.choices[0].message.content
      })
      break;
  }
});

app.listen(8000, () => console.log("Server running on http://localhost:8000"));
