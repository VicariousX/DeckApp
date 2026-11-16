# DeckApp Intent

The goal is a deck builder that feels finished. Features come after the existing ones feel intentional.

## What "finished" means

- Local actions are instant. The UI updates before the network confirms.
- Primary actions look primary everywhere. Secondary actions look secondary.
- Empty states and loading states are designed. They tell the user what to do next.
- Touch targets and press states are obvious. The user always knows what they just did.
- Desktop and mobile share the same actions. Only the input method changes.
- Density is consistent. The deck list is the main thing. Controls do not compete with it.

## What this rules out

- New features that leave the existing board feeling unfinished.
- Visual weight that varies between pages without a reason.
- Waiting on the network for an action the user already performed.
- Empty areas with no next step.
- Mobile and desktop paths that diverge more than the input method requires.

## How to apply this

Before adding a feature, check whether the existing path for that action already feels finished. If it does not, finish it first.

When changing layout, keep the vertical rhythm of card rows, group headers, and board tabs consistent. Reduce dead space on mobile. Make the primary action visually dominant.

When changing state, update the UI immediately. Sync in the background. Restore scroll and focus when the user returns.

## Current focus

Polish the deck builder board: density, empty/loading states, micro-feedback, optimistic updates, and scroll restoration. Features (recommendations, price, packages) come after the board feels finished.
