# Pro Subscription Illustration

Updated the `pro-activated` illustration used by **Welcome to Pro!** on 2026-10-22.

- Tool: built-in `image_gen` (imagegen skill), with transparent-background output.
- Asset: `assets/illustrations/feedback/pro-activated.png`.
- Concept: the Pro badge's rounded three-tip gold crown, paired with a violet access card and a small confirmation check.
- The existing `SuccessFeedback` component supplies the theme-aware circular backdrop; the PNG keeps its surrounding canvas transparent.
- The `pro-restored` illustration and subscription behavior remain unchanged.

## Final Prompt

```text
Use case: illustration-story.
Asset type: transparent square success-feedback illustration for the "Welcome to Pro!" screen in Ambagan, a Filipino shared-expense and personal-spending app, displayed at approximately 240 px.

Input images:
Image 1 (pro-activated.png): the illustration being replaced; retain its bold deep-plum outline weight, simple readable shapes, transparent canvas, and comparable visual scale, but replace the open-notebook subject entirely.
Image 2 (ambagan-shared-expenses.png): primary art-direction reference for flat editorial colored-paper silhouettes, slightly irregular hand-cut contours, restrained human character, and the violet/lavender/deep-plum palette.
Image 3 (pro-light.png): crown identity reference. Echo its recognizable three rounded crown tips and wide base; use a warm gold crown so the new illustration relates directly to the Ambagan Pro badge.

Primary request: Create one focused illustration of a large, gently tilted warm-gold three-point crown resting against a single violet membership pass, with a small lavender backing layer. The crown is the clear focal point, occupying most of the artwork. The membership pass has only two short off-white abstract horizontal strokes and one small muted-green, hand-drawn confirmation check near its lower corner, suggesting that Pro access has been activated. The crown must read as a crown, with three circular rounded tips and two valleys, like the supplied Pro badge. Do not draw jewels or ornament.

Style/medium: flat editorial paper-cut illustration, bold simple silhouettes, crisp substantial deep-plum outlines with a little intentional contour irregularity. Understated and specific. Restrained, asymmetrical arrangement with strong negative space. No people. Use solid flat color regions, no gradients or shading.

Color palette: violet #7C3AED, lavender #DDD6FE, deep plum #2E1065, warm off-white only inside objects, and warm muted amber/gold for the crown with one small muted-green checkmark.

Composition/framing: a single cohesive centered cluster filling approximately 80% of a square canvas, with clear margins all around and no cropping. Readable at 240 px. The existing app places a separate lavender circle behind this asset at runtime: DO NOT bake in any background circle, disc, halo, enclosing frame, or backdrop.

Output: one square PNG with a genuinely transparent surrounding canvas and clean alpha edges. Keep the illustration readable on both white and near-black app backgrounds.
Text: no words, no letters, no numbers, no logo.
Avoid: floating coins, money symbols, wallets, piggy banks, arrows, sparkles, confetti, ribbons, trophy pedestals, royal props, extra badges, symmetrical radial layouts, generic startup graphics, glossy 3D, metallic lighting, gradients, glass effects, cast shadows, textures, excessive decoration, white rectangular background, and checkerboard pixels baked into the image.
```
