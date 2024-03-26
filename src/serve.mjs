import OpenAI from "openai";
import express from "express";
import { default as API_KEYS } from "../api-keys.json" with { type: "json" };

// TODO
// add more model opeions for Anything, Kandinsky, Stable Diffusion on RunPod
// try to host llava on RunPod for faster response time than local

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
  console.log('postRequest', endpoint, apiKey, params)
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

  let endpoint, apiKey, params;
  switch (req.body.model) {
    case 'openjourney':
      endpoint = "https://api.runpod.ai/v2/sd-openjourney/runsync";
      apiKey = API_KEYS.RUNPOD;
      params = {
        input: {
          prompt,
          height: 512,
          width: 512,
          num_outputs: 1    // Stable Diffusion v2 & Anything v4 use the same argument name, Stable Diffusion XL & Kandinsky name it num_images
        }
      }
      break;
    case 'dalle3':
      endpoint = "https://api.openai.com/v1/images/generations";
      apiKey = API_KEYS.OPENAI;
      params = {
        model: "dall-e-3",
        quality: "standard",   // $0.04 / image
        size: "1024x1024",
        style: "vivid",
        response_format: "url", // valid for 60min only
        prompt
      }
      break;
  }
  
  const response = await postRequest(endpoint, apiKey, params);
  console.log('received', response)
  
  let url, error;
  switch (req.body.model) {
    case 'openjourney':
      error = response.status !== "COMPLETED" ? response.status : "",
      url = response.output[0].image
      break;
    case 'dalle3':
      error = "",
      url = response.data[0].url
      break;
  }

  res.json({ error, url, model: req.body.model })
});

app.post("/image/describe", async (req, res) => {
  let endpoint, apiKey, params;

  switch (req.body.model) {
    case 'llava':
      // Ollama
      endpoint = "http://localhost:11434/api/generate";
      apiKey = "unused";
      params = {
        model: "llava",
        prompt: `${req.body.system}. ${req.body.prompt}`,
        images: [await convertImageToBase64(req.body.url)],
        stream: false
      };
      break;
    case 'gpt4v':
      endpoint = "https://api.openai.com/v1/chat/completions";
      apiKey = API_KEYS.OPENAI;
      params = {
        model: "gpt-4-vision-preview",
        messages: [
          { role: "system", content: req.body.system },
          { role: "user", content: [
            { type: "text", text: req.body.prompt },
            { type: "image_url", image_url: req.body.url }
          ]}
        ]
      };
      break;
    }

  const response = await postRequest(endpoint, apiKey, params);
  console.log('received', response);
    
  let error, desc;
  switch (req.body.model) {
    case 'llava':
      error = response.error ?? "";
      desc = response.response;
      break;
    case 'gpt4v':
      error = response.choices[0].finish_reason !== "stop" ? response.choices[0].finish_reason : "";
      desc = response.choices[0].message.content;
      break;
    }

    res.json({ error, desc, model: req.body.model });
});

app.listen(8000, () => console.log("Server running on http://localhost:8000"));
