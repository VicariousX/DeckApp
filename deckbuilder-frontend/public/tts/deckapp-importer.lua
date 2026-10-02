-- DeckApp selector for Tabletop Simulator.
-- Spawn any object, paste this script, and click DeckApp.
-- Chat still works: !deckapp <public deck url or id>

local API = "https://deckapp-bwio.onrender.com/api/tts/"
local BACK = "https://backs.scryfall.io/large/0/0/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg"
local decks = {}
local shown = {}

function onLoad()
  self.clearButtons()
  self.createButton({
    click_function = "openGui",
    function_owner = self,
    label = "DeckApp",
    position = {0, 0.4, 0},
    rotation = {0, 180, 0},
    width = 1600,
    height = 400,
    font_size = 160,
    color = {0.16, 0.12, 0.24},
    font_color = {0.93, 0.9, 1},
  })
end

function openGui()
  broadcastToAll("Loading public decks…", {0.8, 0.8, 1})
  WebRequest.get(API .. "decks", function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck list failed (" .. tostring(req.response_code) .. "): " .. tostring(req.error or req.text), {1, 0.4, 0.4})
      return
    end
    local data = JSON.decode(req.text)
    decks = data.decks or {}
    if #decks == 0 then
      broadcastToAll("No public decks.", {1, 0.7, 0.4})
      return
    end
    broadcastToAll("Found " .. #decks .. " public decks. Pick one on the object.", {0.6, 1, 0.6})
    drawGui(decks)
  end)
end

function drawGui(list)
  shown = list
  self.clearButtons()
  self.createButton({
    click_function = "closeGui",
    function_owner = self,
    label = "Close",
    position = {0, 0.4, 1.1},
    rotation = {0, 180, 0},
    width = 2200,
    height = 300,
    font_size = 140,
    color = {0.28, 0.18, 0.32},
    font_color = {0.93, 0.9, 1},
  })
  for i, deck in ipairs(list) do
    self.createButton({
      click_function = "pickShown",
      function_owner = self,
      label = (deck.name or "Deck") .. "  ·  " .. (deck.format or ""),
      position = {0, 0.4, 1.1 - i * 0.7},
      rotation = {0, 180, 0},
      width = 2200,
      height = 340,
      font_size = 130,
      color = {0.16, 0.12, 0.24},
      font_color = {0.93, 0.9, 1},
    })
  end
end

function pickShown(_, _, id)
  local deck = shown[id]
  if not deck then return end
  closeGui()
  loadDeck(deck.id, self.getPosition())
end

function closeGui()
  onLoad()
end

function onChat(message)
  local raw = message:match("^!deckapp%s+(.+)$")
  if not raw then return end
  local id = raw:match("([0-9a-fA-F%-]+)%s*$")
  if not id then return end
  loadDeck(id, nil)
  return false
end

function loadDeck(id, pos)
  broadcastToAll("Loading deck…", {0.8, 0.8, 1})
  WebRequest.get(API .. "deck/" .. id, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck load failed: " .. tostring(req.error or req.text), {1, 0.4, 0.4})
      return
    end
    spawnDeck(JSON.decode(req.text), pos)
  end)
end

function spawnDeck(data, pos)
  pos = pos or {0, 3, 0}
  local pending = {}
  for _, card in ipairs(data.cards or {}) do
    if card.board ~= "maybe" then
      for _ = 1, (card.quantity or 1) do table.insert(pending, card) end
    end
  end
  if #pending == 0 then
    broadcastToAll("Deck has no cards.", {1, 0.6, 0.4})
    return
  end
  local spawned = {}
  local left = #pending
  for i, card in ipairs(pending) do
    spawnObject({
      type = "Card",
      position = {pos.x + 2, pos.y + 1 + i * 0.02, pos.z},
      callback_function = function(obj)
        obj.setCustomObject({ face = card.face, back = BACK })
        obj.setName(card.name)
        obj.reload()
        Wait.time(function()
          table.insert(spawned, obj)
          left = left - 1
          if left == 0 then
            local deck = spawned[1]
            for n = 2, #spawned do deck = deck.putObject(spawned[n]) or deck end
            deck.setName(data.name or "DeckApp deck")
            broadcastToAll("Spawned " .. (data.name or "deck"), {0.6, 1, 0.6})
          end
        end, 0.5)
      end
    })
  end
end
