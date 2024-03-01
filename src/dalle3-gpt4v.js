import OpenAI from "openai";

// esbuild live-reload
new EventSource('/esbuild').addEventListener('change', () => location.reload());

// AI

const apiKey = "<YOUR KEY HERE>";
const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

// UI
// global variable desc, send, abord, rounds, temp, guess

// Event handlers

let running = false;

function stop() {
  console.log('stop called')
  running = false;
  // spin.display = "none";
}

function start() {
  running = true;
  // spin.display = "block";
  // spin = rounds.removeChild(spin);
  rounds.innerText = "";
  // rounds.appendChild(spin);
  generateImage(desc.value, system.value);
}

async function generateImage(msg, sys = "") {
  const response = await openai.images.generate({
    model: "dall-e-3",
    quality: "standard",   // $0.04 / image
    size: "1024x1024",
    style: "vivid",
    response_format: "url", // valid for 60min only
    prompt: sys ? `${sys}: ${msg}` : msg
  });

  const { url, revised_prompt } = response.data[0];
  console.log({ url, revised_prompt });

  const div = document.createElement('div');
  const p = document.createElement('p')
  p.innerText = "DALL.E-3 drew:";
  const img = document.createElement('img');
  img.alt = revised_prompt;
  img.src = url;
  img.width = 512;
  img.height = 512;
  div.appendChild(p);
  div.appendChild(img);

  rounds.appendChild(div);
  // spin = rounds.removeChild(spin);
  // rounds.appendChild(spin);

  // make sure this new image is visible at the bottom of the page
  div.scrollIntoView(true);

  if (running) {
    guessImage(url, guess.value);
  }
}

async function guessImage(url, words) {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          // { type: "text", text: `Describe elements in this image in ${words} words maximum.` },
          // -> list of words e.g. dragon, mountain, pie...
          // => I could ask ChatGPT-3.5 to create a sentence with all these words.
          { type: "text", text: `Describe what happens in this image in ${words} words maximum.` },
          { type: "image_url", image_url: { url, detail: "low" }},
        ],
      },
    ],
    temperature: temp.value,
    max_tokens: 50,
  });
  const guess = response.choices[0].message.content;
  console.log(response);

  const div = document.createElement('p');
  div.innerText = `GPT-4V guessed: ${guess}`

  rounds.appendChild(div)

  // make sure this new text is visible at the bottom of the page
  div.scrollIntoView(true);

  if (running) {
    generateImage(guess, system.value);
  }
}

guess.oninput = _ => guess_val.innerText = guess.value;
temp.oninput = _ => temp_val.innerText = temp.value;
send.onclick = start;
abort.onclick = stop;

