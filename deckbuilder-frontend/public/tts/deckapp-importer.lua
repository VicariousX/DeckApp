-- DeckApp selector for Tabletop Simulator.
-- Spawn any object, paste this script, and click DeckApp.
-- Chat still works: !deckapp <public deck url or id>
-- Card spawn matches the workshop importer: one Card per copy, then putObject into a deck.

local API = "https://deckapp-bwio.onrender.com/api/tts/"
local BACK = "https://deckapp-bwio.onrender.com/api/tts/back.jpg"
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

function loadShown(index)
  local chosen = shown[index]
  if not chosen then
    broadcastToAll("No deck on that button.", {1, 0.5, 0.4})
    return
  end
  broadcastToAll("Loading " .. (chosen.name or "deck") .. "…", {0.8, 0.8, 1})
  local pos = self.getPosition()
  closeGui()
  loadDeck(chosen.id, pos)
end

function pick1() loadShown(1) end
function pick2() loadShown(2) end
function pick3() loadShown(3) end
function pick4() loadShown(4) end
function pick5() loadShown(5) end
function pick6() loadShown(6) end
function pick7() loadShown(7) end
function pick8() loadShown(8) end
function pick9() loadShown(9) end
function pick10() loadShown(10) end
function pick11() loadShown(11) end
function pick12() loadShown(12) end

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
  local names = {"pick1", "pick2", "pick3", "pick4", "pick5", "pick6", "pick7", "pick8", "pick9", "pick10", "pick11", "pick12"}
  for i, deck in ipairs(list) do
    if not names[i] then break end
    self.createButton({
      click_function = names[i],
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

-- Same shape the workshop importer uses. Key 24400 stays an object key in JSON.encode.
function cardJson(card, position)
  local face = card.face or ""
  if face ~= "" and not face:find("?", 1, true) then
    face = face .. "?v=3"
  end
  return {
    Name = "Card",
    Transform = {
      posX = position.x, posY = position.y, posZ = position.z,
      rotX = 0, rotY = 180, rotZ = 180,
      scaleX = 1, scaleY = 1, scaleZ = 1,
    },
    Nickname = card.name or "Card",
    Locked = false,
    Grid = true,
    Snap = true,
    Sticky = true,
    Tooltip = true,
    Hands = true,
    HideWhenFaceDown = true,
    CardID = 2440000,
    SidewaysCard = false,
    CustomDeck = {
      ["24400"] = {
        FaceURL = face,
        BackURL = BACK,
        NumWidth = 1,
        NumHeight = 1,
        BackIsHidden = true,
        UniqueBack = false,
        Type = 0,
      },
    },
  }
end

function stackIntoDeck(objs, name, position)
  if #objs == 0 then return nil end
  local deck = objs[1]
  for i = 2, #objs do
    local stacked = deck.putObject(objs[i])
    if stacked then deck = stacked end
  end
  if deck then
    deck.setName(name)
    deck.setPosition(position)
  end
  return deck
end

function spawnPile(cards, name, position)
  if #cards == 0 then return end
  local objs = {}
  for _, card in ipairs(cards) do
    local qty = card.quantity or 1
    for _ = 1, qty do
      local obj = spawnObjectJSON({
        json = JSON.encode(cardJson(card, position)),
        position = position,
        sound = false,
      })
      if obj then table.insert(objs, obj) end
    end
  end
  Wait.time(function()
    stackIntoDeck(objs, name, position)
    broadcastToAll("Spawned " .. name .. " (" .. #objs .. ")", {0.6, 1, 0.6})
  end, 0.4)
end

function spawnDeck(data, pos)
  pos = pos or {x = 0, y = 3, z = 0}
  local piles = { main = {}, side = {}, commander = {}, maybe = {} }
  for _, card in ipairs(data.cards or {}) do
    local board = card.board or "main"
    if board ~= "maybe" then
      if not piles[board] then board = "main" end
      table.insert(piles[board], card)
    end
  end
  local base = {x = pos.x + 2, y = pos.y + 2, z = pos.z}
  local name = data.name or "DeckApp deck"
  spawnPile(piles.main, name, base)
  spawnPile(piles.side, name .. " sideboard", {x = base.x - 3.2, y = base.y, z = base.z})
  spawnPile(piles.commander, name .. " commander", {x = base.x + 2.4, y = base.y, z = base.z - 2.2})
end
