# Stellar Stories — Future Implementations

This document tracks features and refinements to pursue after the core experience is stable. Items are grouped by theme and loosely ordered by impact-to-effort ratio within each group.

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
