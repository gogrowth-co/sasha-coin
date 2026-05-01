---
name: gemini-image-gen
description: Generate images using the Gemini API based on a provided text prompt. Use when you need to create visual content for social media, presentations, or other purposes.
---

# Gemini Image Generation Skill

This skill allows you to generate images using the Gemini API.

## Usage

To generate an image, you will use the `generate_image.py` script with a text prompt.

```bash
python3 scripts/generate_image.py --prompt "Your detailed image description here" --output-path "path/to/save/image.png"
```

### Arguments

- `--prompt`: (Required) The text description of the image you want to generate.
- `--output-path`: (Required) The path where the generated image will be saved (e.g., `output_image.png`).

## Examples

- Generate an image of a futuristic city:
  `python3 scripts/generate_image.py --prompt "A futuristic city skyline at sunset with flying cars and neon lights" --output-path "futuristic_city.png"`

- Generate an abstract crypto art piece:
  `python3 scripts/generate_image.py --prompt "Abstract art representing blockchain technology with intertwined nodes and glowing data streams" --output-path "crypto_art.jpg"`
