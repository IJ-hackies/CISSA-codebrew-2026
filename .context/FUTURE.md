# Stellar Stories — Future Implementations

This document tracks features and refinements to pursue after the core experience is stable. Items are grouped by theme and loosely ordered by impact-to-effort ratio within each group.

---

## Pre-Rendered Cinematic Cutscenes (Remotion)

### Concept
A small library of hero-moment cutscenes rendered with [Remotion](https://www.remotion.dev/) — React components compiled to real `.mp4` video via headless Chromium + ffmpeg. Used exclusively for non-interactive, high-impact moments where giving up control is expected and where realtime web rendering can't match the quality ceiling (motion blur, depth of field, particle sims, scored beats). Gameplay and frequent transitions stay on the realtime motion stack — Remotion is reserved for moments the user sees rarely but remembers.

### Where It Fits
Three specific slots, and no scope creep past them:
1. **Galaxy birth cinematic.** The "watch your galaxy form" hero moment after upload. Rendered in the background during the Claude extraction pipeline so it's ready by the time the user finishes the upload flow. This is the single biggest wow-factor sell for demos and first-time users.
2. **Finale / completion cutscene.** Rendered lazily when the user crosses ~80% galaxy completion, waiting for them when they finish.
3. **Shareable `/export` mp4.** A 20–30s "here's my galaxy" trailer for social sharing. On-demand, user-initiated, latency doesn't matter.

Explicitly **not** for: system-to-system warps (too frequent, needs responsiveness — shader + GSAP), planet landing intros (too many to pre-render), dialogue/character animation (Rive is strictly better).

### Why It Works Here
The compositions are **data-driven and parameterized** by the galaxy JSON — real palette, real star positions, real topic names — so every rendered cutscene is *about that specific galaxy*, not a generic stock intro. That's what justifies Remotion over a pre-made mp4. Render-on-create (not render-on-play) hides the render latency behind the Claude extraction step, which is already taking 10–30s. By the time the pipeline finishes, the cinematic is cached alongside the galaxy blob.

### Technical Approach
Add a `pipeline/render-cinematic.ts` stage that runs after `galaxy-builder.ts`. It spawns a Remotion render subprocess with the galaxy JSON as input props, writes the output mp4 to disk (or blob storage), and stores the path in the galaxy record. Infra cost is non-trivial: headless Chromium + ffmpeg on the server, likely via a Docker layer or Remotion Lambda. Budget half a day for prod render infra.

### Fallback Path
If the render fails or is still in-flight when the user hits the moment, degrade gracefully to a live-composed GSAP/SVG version of the same scene. This means building each cinematic twice (cheap realtime version + premium rendered version), which is real cost — only worth it for the three slots above.

---

## Adaptive Music System

### Concept
A layered ambient soundtrack that responds to the user's location and actions within the galaxy. Not AI-generated in real time — instead, a system of pre-composed stems that are mixed dynamically.

### How It Would Work
Compose or source a library of audio stems across several categories: deep space ambient drones (for galaxy map navigation), system-specific harmonic layers (warm tones for organic planets, metallic resonances for crystalline worlds, eerie pads for mysterious/abstract topics), rhythmic elements that intensify during challenges, and resolution/reward stings for completed scenes.

The music engine would crossfade between stem combinations based on context. Entering a solar system blends in that system's harmonic layer. Landing on a planet adds terrain-specific textures. Starting a challenge brings in subtle rhythmic tension. Completing it triggers the reward sting and returns to ambient exploration.

### Technical Approach
Use the Web Audio API for stem mixing with gain nodes and crossfade scheduling. Audio files are small (30-60 second loops, compressed to Opus/AAC). Total download budget: roughly 5-10MB for a complete soundtrack. Stems are lazy-loaded per solar system so the initial page load isn't affected. Planet visual parameters (palette, mood, terrain) directly map to stem selection — a "bioluminescent crystalline" planet with a "mysterious" mood selects different harmonic stems than a "volcanic ancient" planet with an "intense" mood.

### Sourcing
Options: royalty-free ambient packs (Artlist, Epidemic Sound), commission a musician to produce modular stems to spec, or use Suno/Udio to pre-generate a large library of categorized stems offline (not real-time generation — curated and quality-checked ahead of time).

---

## Public Library — Community Galaxy Sharing

### Concept
A browsable, searchable library where users can publish their galaxies for others to explore. "Someone already made a galaxy for Organic Chemistry 201? Let me try theirs." This turns Stellar Stories from a personal study tool into a learning content platform.

### How It Would Work
After completing (or during) their galaxy exploration, a user can hit "Publish to Library." This flags their galaxy as public and prompts for metadata: subject, course name, difficulty level, a short description. The galaxy appears in the public library, searchable and browsable by subject, popularity, and recency. Other users can "fork" a public galaxy — they get their own copy with fresh progress tracking, but the same content and structure.

### Design Considerations
- **No accounts still.** Publishing creates an edit token in the URL that the creator bookmarks. The public URL is clean. If we later add accounts, we can retroactively link galaxies to accounts via the edit token.
- **Quality signal.** Allow anonymous ratings (thumbs up/down, gated behind actually visiting at least 3 planets so only real users rate). Surface "most explored" and "highest rated" on the library homepage.
- **Content moderation.** Published galaxies go through a quick Claude-based content check before appearing publicly. Flag anything that's clearly not educational content or that contains harmful material.
- **Forking vs. linking.** A fork is a full copy so the original creator can't break someone else's experience by editing. This means storage grows linearly with forks — acceptable at small scale, worth revisiting with deduplication if the library gets large.

### Data Model Extension
Add a `published_galaxies` index (separate from the per-galaxy JSON blobs) that stores: galaxy UUID, title, subject tags, description, creator edit token hash, publish date, visit count, rating aggregate. This is the only queryable table — everything else stays in the JSON blob pattern.

---

## Multiplayer / Collaborative Exploration

### Concept
Multiple users explore the same galaxy simultaneously. They can see each other's cursors on the galaxy map, land on planets together, and collaboratively tackle challenges. Study groups become space expeditions.

### How It Would Work
A "create session" button generates a room code. Others join via the code. The server maintains a lightweight presence state via WebSocket: who's online, where they are on the map, their progress. When two users land on the same planet, they see each other's avatars in the scene. Challenges could become collaborative — one user answers, the other provides hints, or the challenge requires combining knowledge from two different planets that each user has already visited.

### Technical Implications
This is the feature that would require WebSocket (or at minimum, SSE with polling). The presence state is tiny (user ID, current location, progress summary) so the bandwidth is minimal. The challenge is scene generation — if two users land simultaneously, you need to generate a scene variant that acknowledges both players. This means the scene generation prompt gets a "multiplayer context" addition.

### Lightweight Version First
Before full multiplayer: implement "asynchronous collaboration." User A explores a galaxy and leaves notes/annotations on planets ("this concept connects to what we learned in Week 3"). User B opens the same galaxy link and sees A's annotations. No real-time presence, but still collaborative. Much simpler to build.

---

## Advanced Content Ingestion

### Image & Diagram Extraction
Current pipeline handles text well but ignores diagrams, charts, and images in uploaded PDFs. Future: use Claude's vision capability to analyze images within documents. Extract the conceptual content of a diagram ("this is a flowchart showing the Krebs cycle with these steps...") and incorporate it into the knowledge tree. Potentially recreate key diagrams as interactive SVG elements within planet scenes.

### Handwritten Notes
Support photographed handwritten notes via Claude's vision. The user takes a photo of their notebook, uploads it, and the system extracts structured knowledge. This is particularly compelling for STEM subjects where students draw diagrams and write formulas by hand.

### Live Lecture Integration
Connect to a lecture recording or live stream transcript. The galaxy builds in real time as the lecture progresses. Students open Stellar Stories during class and watch their galaxy form as the professor talks. Post-lecture, the galaxy is ready to explore. Integration with transcript APIs (Whisper, AssemblyAI) or direct audio upload with server-side transcription.

### Multi-Source Synthesis
Allow users to upload multiple documents that get synthesized into a single galaxy. Upload the textbook chapter, lecture notes, and tutorial worksheet — the system identifies overlapping content, unique content per source, and contradictions. The galaxy structure reflects the combined knowledge, with planets annotated by source ("this concept is covered in the textbook and lecture notes but not the tutorial").

---

## Enhanced Assessment & Learning Analytics

### Spaced Repetition Integration
Track when the user last visited each planet and how well they performed. Surface "fading" planets on the galaxy map — planets whose knowledge is decaying based on the Ebbinghaus forgetting curve. Prompt the user: "Planet Mitochondria is fading — revisit to reinforce." Generate a new scene variant for revisits so the experience is fresh even when reviewing old material.

### Knowledge Gap Detection
Analyze challenge performance across the galaxy to identify systematic gaps. If a user consistently struggles with planets related to a specific foundational concept, surface that: "You seem to be having trouble with topics that build on probability theory. Want to explore the Probability Nebula first?" This requires tracking concept dependencies in the knowledge tree and correlating them with performance data.

### Export Study Summary
After exploring a galaxy, export a traditional study document — a structured summary of all concepts, organized by mastery level. "Here's what you know well, here's what needs review, here's what you haven't covered yet." This bridges the gap between the immersive experience and practical exam prep.

### Challenge Difficulty Scaling
Currently, Claude generates challenges at a fixed difficulty. Future: implement adaptive difficulty. Track the user's running accuracy and adjust the scene generation prompt: "this user has answered 8/10 correctly — increase challenge complexity" or "this user is struggling — simplify the challenge and add more scaffolding." The difficulty parameter feeds into both the challenge itself and the narrative framing (a struggling user might get a more encouraging, hint-rich guardian; an advanced user gets a more cryptic, open-ended challenge).

---

## Visual & Experience Enhancements

### 3D Galaxy Map (Three.js)
Upgrade the galaxy map from 2D Canvas/SVG to a full Three.js 3D scene. Users rotate, zoom, and fly through their galaxy. Solar systems have actual orbital mechanics. Planets are 3D spheres with procedural textures. This is a significant engineering effort but the visual payoff is enormous for the "wow factor" and the spatial memory benefit.

### Planet Surface Exploration
Currently, landing on a planet triggers a scene — essentially a visual novel interface. Future: make the planet surface explorable. A top-down or side-scrolling view where the user moves an avatar across terrain, discovering landmarks that each contain a piece of the concept. This turns each planet from a single scene into a mini-level. Higher engagement, but much more complex to build.

### Procedural Creature/NPC Design
Instead of text-only guardians, generate visual NPCs for each planet. Use the same procedural composition approach as terrain — a library of body parts, features, and accessories that are combined and recolored based on planet parameters. A crystalline planet gets a geometric, faceted guardian. An organic planet gets a flowing, tentacled one. These don't need to be animated beyond simple idle cycles.

### Cinematic Transitions
Add transitions between galaxy map, solar system view, and planet surface. A zoom-from-orbit camera move when landing. A warp-speed streaking effect when jumping between systems. A gentle pull-back when returning to the galaxy map. These transitions reinforce the spatial metaphor and make navigation feel physical.

### Accessibility
Full keyboard navigation for the galaxy map and scenes. Screen reader support with semantic descriptions of visual elements ("You are orbiting Planet Recursion, a crystalline world with two moons. Three landmarks are visible on the surface."). High contrast mode. Reduced motion mode that disables parallax and particles. Dyslexia-friendly font option.

---

## Platform Expansion

### Mobile-Native Experience
The web app should work on mobile from day one (responsive design), but a dedicated mobile experience could lean into touch gestures — pinch to zoom the galaxy, swipe to orbit planets, tap to land. The parallax scene engine maps naturally to device gyroscope input for a pseudo-AR effect (tilt phone to look around the planet surface).

### Offline Mode
Cache the galaxy structure and pre-generate scenes for a set of planets so the user can explore without connectivity. Use a Service Worker to intercept requests and serve cached content. New scenes can't be generated offline, but previously visited planets can be revisited and challenges re-attempted. Sync progress when connectivity returns.

### API / Embed Mode
Expose Stellar Stories as an embeddable widget that educators can drop into their LMS (Canvas, Moodle, Blackboard). The educator provides course content via the API, and students access the galaxy directly within their existing learning environment. This is the path to institutional adoption.

---

## Monetization Considerations (Long-Term)

These are not hackathon concerns but worth documenting for direction.

- **Free tier.** Upload up to N pages of notes, generate one galaxy at a time. Galaxies expire after 7 days. This covers casual/individual use.
- **Pro tier.** Unlimited uploads, permanent galaxies, priority scene generation (dedicated API capacity), advanced analytics and spaced repetition, export features.
- **Institutional tier.** Bulk creation, LMS integration, class-wide analytics dashboard for educators, custom theming. Per-seat or per-institution pricing.
- **Library marketplace.** High-quality published galaxies could be premium content. Creators earn a share. Think "Udemy but spatial and exploratory."

The free tier should always be generous enough to demonstrate the full experience — the conversion trigger is "I want this for all my courses" not "I hit a wall."

---

## Technical Debt & Refactors (Post-Hackathon)

Things we'll cut corners on during the hackathon that need to be addressed for production:

- **Migrate from SQLite to Postgres** if user/galaxy volume justifies it. The key-value pattern transfers cleanly.
- **Add proper error handling** throughout the pipeline. Currently, a failed Claude API call could leave a galaxy in a partial state.
- **Rate limiting** on galaxy creation to prevent abuse (someone scripting thousands of creation requests to burn API credits).
- **Content caching.** If multiple users explore the same public galaxy, scene generation could cache popular planet scenes instead of regenerating each time.
- **Monitoring and observability.** Structured logging, API latency tracking, error rates, Claude API usage dashboards.
- **Testing.** Unit tests for the extraction pipeline, integration tests for the full creation flow, visual regression tests for scene rendering.
- **CDN for static assets.** SVG building blocks, fonts, and audio stems served from a CDN rather than the origin server.