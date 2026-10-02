-- DeckApp importer for Tabletop Simulator.
-- Paste into an object, or into Global if you add the button yourself.
-- Chat: !deckapp <deck url or id>

local API = "https://deckapp-bwio.onrender.com/api/tts/deck/"
local BACK = "https://backs.scryfall.io/large/0/0/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg"

function onLoad()
  self.createButton({
    click_function = "noop",
    function_owner = self,
    label = "DeckApp",
    position = {0, 0.3, 0},
    width = 900,
    height = 300,
    font_size = 120,
  })
end

function noop() end

function onChat(message, player)
  local id = message:match("^!deckapp%s+(.+)$")
  if not id then return end
  id = id:match("([0-9a-fA-F%-]+)%s*$") or id
  id = id:match("([0-9a-fA-F]+%-[0-9a-fA-F%-]+)$") or id
  broadcastToAll("Loading DeckApp deck…", {0.8, 0.8, 1})
  WebRequest.get(API .. id, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("DeckApp load failed: " .. (req.error or req.text), {1, 0.4, 0.4})
      return
    end
    local data = JSON.decode(req.text)
    spawnDeck(data, player.getPointerPosition())
  end)
  return false
end

function spawnDeck(data, pos)
  pos = pos or {0, 3, 0}
  local pending = {}
  for _, card in ipairs(data.cards or {}) do
    local qty = card.quantity or 1
    for _ = 1, qty do
      if card.board ~= "maybe" then
        table.insert(pending, card)
      end
    end
  end
  local spawned = {}
  local left = #pending
  if left == 0 then
    broadcastToAll("Deck has no cards.", {1, 0.6, 0.4})
    return
  end
  for i, card in ipairs(pending) do
    spawnObject({
      type = "Card",
      position = {pos.x, pos.y + i * 0.05, pos.z},
      callback_function = function(obj)
        obj.setCustomObject({ face = card.face, back = BACK })
        obj.setName(card.name)
        obj.reload()
        Wait.time(function()
          table.insert(spawned, obj)
          left = left - 1
          if left == 0 then
            local deck = spawned[1]
            for n = 2, #spawned do
              deck = deck.putObject(spawned[n]) or deck
            end
            deck.setName(data.name or "DeckApp deck")
            broadcastToAll("Spawned " .. (data.name or "deck"), {0.6, 1, 0.6})
          end
        end, 0.4)
      end
    })
  end
end
