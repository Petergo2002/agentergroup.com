# Assistant Chat UI Redesign Specification

## 1. Vision
Transform the assistant chat into a premium, immersive "AI-portal" experience, following industry standards (Claude, Gemini, ChatGPT) while maintaining Agenter integration branding.

## 2. Structural Changes
- **Retractable Sidebar**: Smooth transitions, date-grouped sessions, glassmorphism.
- **Unified Logic**: One "New Chat" entry point, removing redundant buttons.
- **Hero State**: Large, centered greeting for new conversations.

## 3. Visual Identity
- **Atmosphere**: Deep violet/indigo radial gradients.
- **Glassmorphism**: High-blur panels with thin, light borders.
- **Typography**: Manrope for headlines, Inter for body.
- **Accent**: Brand Orange (#f26b2f) for interactive elements and user bubbles.

## 4. Interaction Design
- **Nexus Input Bar**: Pill-shaped, floating centered input with "Attach" and "Deep Thinking" capabilities.
- **Dynamic Messaging**: Staggered entry animations and soft shadow elevations for bubbles.

## 5. Technical Implementation
- **Components**: Modularized into `ChatInput`, `MessageList`, and `ThreadSidebar`.
- **State**: Optimized `activeThreadId` and `isSending` handling.
