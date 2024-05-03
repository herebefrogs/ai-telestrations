import express from "express";
import { default as API_KEYS } from "../api-keys.json" with { type: "json" };


const app = express();
app.use(express.static("www"));
app.use(express.json()) // for parsing req.body when mine type is application/json

const CONFIG = {
  OLLAMA: {
    ENDPOINT: process.env.RUNPOD_ID ? `https://${process.env.RUNPOD_ID}-11434.proxy.runpod.net` : "http://localhost:11434",
  }
}
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
  let { model, system, prompt } = req.body;
  prompt = system ? `${system}: ${prompt}` : prompt;
  console.log({prompt})

  let endpoint, apiKey, params;
  switch (model) {
    case 'stable-diffusion-v2':
    case 'sd-anything-v4':
    case 'sd-openjourney':
      endpoint = `https://api.runpod.ai/v2/${model}/runsync`;
      apiKey = API_KEYS.RUNPOD;
      params = {
        input: {
          prompt,
          height: 384,
          width: 512,
          num_outputs: 1
        }
      }
      break;
    case 'kandinsky-v2':
      endpoint = `https://api.runpod.ai/v2/${model}/runsync`;
      apiKey = API_KEYS.RUNPOD;
      params = {
        input: {
          prompt,
          h: 1024,
          w: 1792,
          num_images: 1
        }
      }
      break;
    case 'sdxl':
      endpoint = `https://api.runpod.ai/v2/${model}/runsync`;
      apiKey = API_KEYS.RUNPOD;
      params = {
        input: {
          prompt,
          height: 1024,
          width: 1792,
          num_images: 1
        }
      }
      break;
    case 'dalle3':
      endpoint = "https://api.openai.com/v1/images/generations";
      apiKey = API_KEYS.OPENAI;
      params = {
        model: "dall-e-3",
        quality: "standard",   // $0.04 / image
        size: "1792x1024",
        style: "vivid",
        response_format: "url", // valid for 60min only
        prompt
      }
      break;
  }
  
  const response = await postRequest(endpoint, apiKey, params);
  console.log('received', response)
  
  let url, error;
  switch (model) {
    case 'stable-diffusion-v2':
    case 'sd-anything-v4':
    case 'sd-openjourney':
      error = response.status !== "COMPLETED" ? response.status : "",
      url = response.output[0]?.image
      break;
    case 'kandinsky-v2':
    case 'sdxl':
      error = response.status !== "COMPLETED" ? response.status : "",
      url = response.output?.image_url;
      break;
    case 'dalle3':
      error = "",
      url = response.data[0]?.url
      break;
  }

  res.json({ error, url, model })
});

app.post("/image/describe", async (req, res) => {
  let { model, system, prompt, url } = req.body;
  let endpoint, apiKey, params;

  switch (model) {
    case 'moondream':
    case 'bakllava':
    case 'llava':
      // Ollama
      endpoint = CONFIG.OLLAMA.ENDPOINT + "/api/generate";
      apiKey = null;
      params = {
        model,
        prompt: `${system}: ${prompt}`,
        images: [await convertImageToBase64(url)],
        stream: false
      };
      break;
    case 'gpt4v':
      endpoint = "https://api.openai.com/v1/chat/completions";
      apiKey = API_KEYS.OPENAI;
      params = {
        model: "gpt-4-vision-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: url }
          ]}
        ]
      };
      break;
    }

  const response = await postRequest(endpoint, apiKey, params);
  console.log('received', response);
    
  let error, desc;
  switch (model) {
    case 'moondream':
    case 'bakllava':
    case 'llava':
      error = response.error ?? "";
      desc = response?.response;
      break;
    case 'gpt4v':
      error = response.error?.message ?? "";
      desc = !error ? response.choices[0]?.message?.content : "";
      break;
    }

    res.json({ error, desc, model });
});

app.listen(8000, () => console.log("Server running on http://localhost:8000"));
