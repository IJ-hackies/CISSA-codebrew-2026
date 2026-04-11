# Scholar System — Future Implementations

This document tracks features and refinements to pursue after the core experience is stable. Items are grouped by theme and loosely ordered by impact-to-effort ratio within each group.

---

## Adaptive Music System

### Concept
A layered ambient soundtrack that responds to the user's location and actions within the galaxy. Not AI-generated in real time — instead, a system of pre-composed stems that are mixed dynamically.

### How It Would Work
Compose or source a library of audio stems across several categories: deep space ambient drones (for galaxy map navigation), solar-system-specific harmonic layers (warm tones for organic planets, metallic resonances for crystalline worlds, eerie pads for mysterious/abstract topics), rhythmic elements that intensify during story reading, and transition stings for navigating between solar systems.

The music engine would crossfade between stem combinations based on context. Entering a solar system blends in that system's harmonic layer. Clicking a planet adds terrain-specific textures. Opening a story shifts to narrative-appropriate ambience.

### Technical Approach
Use the Web Audio API for stem mixing with gain nodes and crossfade scheduling. Audio files are small (30-60 second loops, compressed to Opus/AAC). Total download budget: roughly 5-10MB for a complete soundtrack. Stems are lazy-loaded per solar system so the initial page load isn't affected.

### Sourcing
Options: royalty-free ambient packs (Artlist, Epidemic Sound), commission a musician to produce modular stems to spec, or use Suno/Udio to pre-generate a large library of categorized stems offline (not real-time generation — curated and quality-checked ahead of time).

---

## Public Library — Community Galaxy Sharing

### Concept
A browsable, searchable library where users can publish their galaxies for others to explore. "Someone already made a galaxy for Organic Chemistry 201? Let me try theirs." This turns Scholar System from a personal tool into a learning content platform.

### How It Would Work
After completing their galaxy, a user can hit "Publish to Library." This flags their galaxy as public and prompts for metadata: subject, course name, difficulty level, a short description. The galaxy appears in the public library, searchable and browsable by subject, popularity, and recency. Other users can "fork" a public galaxy — they get their own copy to explore with fresh progress tracking.

### Design Considerations
- **No accounts still.** Publishing creates an edit token in the URL that the creator bookmarks. The public URL is clean.
- **Quality signal.** Allow anonymous ratings (thumbs up/down, gated behind actually visiting at least 3 planets so only real users rate). Surface "most explored" and "highest rated" on the library homepage.
- **Content moderation.** Published galaxies go through a quick Claude-based content check before appearing publicly.
- **Forking vs. linking.** A fork is a full copy so the original creator can't break someone else's experience by editing.

---
