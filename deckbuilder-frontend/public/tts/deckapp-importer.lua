-- DeckApp selector for Tabletop Simulator.
-- Paste onto an object. Skin is saved on the object.
-- Library and sideboard spawn face down. Commanders and tokens spawn face up.

local API = "https://deckapp-bwio.onrender.com/api/tts/"
local decks = {}
local shown = {}
local skins = {
  { id = "classic", name = "Classic" },
  { id = "arcane", name = "Arcane" },
  { id = "night", name = "Night" },
  { id = "parchment", name = "Parchment" },
  { id = "ember", name = "Ember" },
  { id = "tide", name = "Tide" },
}
local selected = { id = "classic", name = "Classic" }
local mode = "home"

function skinUrl()
  if selected.url and selected.url ~= "" then
    return selected.url
  end
  return API .. "skin/" .. (selected.id or "classic") .. ".jpg?v=1"
end

function onSave()
  return JSON.encode({ skin = selected })
end

function onLoad(saved)
  if saved and saved ~= "" then
    local data = JSON.decode(saved)
    if data and data.skin and data.skin.id then selected = data.skin end
  end
  drawHome()
end

function drawHome()
  mode = "home"
  self.clearButtons()
  self.createButton({
    click_function = "openGui",
    function_owner = self,
    label = "DeckApp",
    position = {0, 0.4, 0.35},
    rotation = {0, 0, 0},
    width = 1600,
    height = 360,
    font_size = 150,
    color = {0.16, 0.12, 0.24},
    font_color = {0.93, 0.9, 1},
  })
  self.createButton({
    click_function = "openSkins",
    function_owner = self,
    label = "Skin: " .. (selected.name or "Classic"),
    position = {0, 0.4, -0.45},
    rotation = {0, 0, 0},
    width = 1600,
    height = 320,
    font_size = 130,
    color = {0.22, 0.16, 0.3},
    font_color = {0.93, 0.9, 1},
  })
end

function openSkins()
  mode = "skins"
  broadcastToAll("Pick a card skin. It is saved on this object.", {0.8, 0.8, 1})
  WebRequest.get(API .. "skins", function(req)
    if not req.is_error and req.response_code == 200 then
      local data = JSON.decode(req.text)
      if data and data.skins and #data.skins > 0 then skins = data.skins end
    end
    drawSkins()
  end)
end

function drawSkins()
  shown = skins
  self.clearButtons()
  self.createButton({
    click_function = "closeGui",
    function_owner = self,
    label = "Back",
    position = {0, 0.4, 1.1},
    rotation = {0, 0, 0},
    width = 2200,
    height = 300,
    font_size = 140,
    color = {0.28, 0.18, 0.32},
    font_color = {0.93, 0.9, 1},
  })
  local names = {"pick1", "pick2", "pick3", "pick4", "pick5", "pick6", "pick7", "pick8", "pick9", "pick10", "pick11", "pick12"}
  for i, skin in ipairs(skins) do
    if not names[i] then break end
    local mark = ""
    if skin.id == selected.id then mark = " *" end
    self.createButton({
      click_function = names[i],
      function_owner = self,
      label = (skin.name or skin.id) .. mark,
      position = {0, 0.4, 1.1 - i * 0.7},
      rotation = {0, 0, 0},
      width = 2200,
      height = 340,
      font_size = 140,
      color = {0.16, 0.12, 0.24},
      font_color = {0.93, 0.9, 1},
    })
  end
end

function openGui()
  mode = "decks"
  broadcastToAll("Loading public decks...", {0.8, 0.8, 1})
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
    broadcastToAll("Skin: " .. (selected.name or "Classic") .. ". Pick a deck.", {0.6, 1, 0.6})
    drawGui(decks)
  end)
end

function loadShown(index)
  local chosen = shown[index]
  if not chosen then
    broadcastToAll("Nothing on that button.", {1, 0.5, 0.4})
    return
  end
  if mode == "skins" then
    selected = { id = chosen.id, name = chosen.name, url = chosen.url }
    self.script_state = JSON.encode({ skin = selected })
    broadcastToAll("Skin set to " .. (selected.name or selected.id), {0.6, 1, 0.6})
    drawHome()
    return
  end
  broadcastToAll("Loading " .. (chosen.name or "deck") .. "...", {0.8, 0.8, 1})
  local pos = self.getPosition()
  drawHome()
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
    rotation = {0, 0, 0},
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
      label = (deck.name or "Deck") .. " - " .. (deck.format or ""),
      position = {0, 0.4, 1.1 - i * 0.7},
      rotation = {0, 0, 0},
      width = 2200,
      height = 340,
      font_size = 130,
      color = {0.16, 0.12, 0.24},
      font_color = {0.93, 0.9, 1},
    })
  end
end

function closeGui()
  drawHome()
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
  broadcastToAll("Loading deck with " .. (selected.name or "Classic") .. " skin...", {0.8, 0.8, 1})
  WebRequest.get(API .. "deck/" .. id, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck load failed: " .. tostring(req.error or req.text), {1, 0.4, 0.4})
      return
    end
    spawnDeck(JSON.decode(req.text), pos)
  end)
end

function withCache(url)
  if not url or url == "" then return "" end
  if url:find("?", 1, true) then return url .. "&v=4" end
  return url .. "?v=4"
end

function cardJson(name, face, position, faceDown)
  local rotZ = 0
  if faceDown then rotZ = 180 end
  return {
    Name = "Card",
    Transform = {
      posX = position.x, posY = position.y, posZ = position.z,
      rotX = 0, rotY = 0, rotZ = rotZ,
      scaleX = 1, scaleY = 1, scaleZ = 1,
    },
    Nickname = name or "Card",
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
        FaceURL = withCache(face),
        BackURL = skinUrl(),
        NumWidth = 1,
        NumHeight = 1,
        BackIsHidden = true,
        UniqueBack = false,
        Type = 0,
      },
    },
  }
end

function encodeCard(payload)
  local states = payload.States
  payload.States = nil
  local raw = JSON.encode(payload)
  if not states or not states["2"] then return raw end
  local state2 = JSON.encode(states["2"])
  return raw:sub(1, -2) .. ',"States":{"2":' .. state2 .. "}}"
end

function cardPayload(card, position, faceDown)
  local frontName = card.name
  local frontFace = card.face
  if card.faces and card.faces[1] then
    frontName = card.faces[1].name or frontName
    frontFace = card.faces[1].face or frontFace
  end
  local payload = cardJson(frontName, frontFace, position, faceDown)
  payload.Description = "State 1"
  if card.faces and card.faces[2] and card.faces[2].face then
    local back = cardJson(card.faces[2].name or (frontName .. " back"), card.faces[2].face, position, faceDown)
    back.Description = "State 2"
    payload.States = { ["2"] = back }
  end
  return encodeCard(payload)
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

function spawnPile(cards, name, position, faceDown)
  if not cards or #cards == 0 then return end
  local objs = {}
  for _, card in ipairs(cards) do
    local qty = card.quantity or 1
    for _ = 1, qty do
      local obj = spawnObjectJSON({
        json = cardPayload(card, position, faceDown),
        position = position,
        rotation = {0, 0, faceDown and 180 or 0},
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
  local piles = { main = {}, side = {}, commander = {} }
  for _, card in ipairs(data.cards or {}) do
    local board = card.board or "main"
    if board ~= "maybe" then
      if board ~= "side" and board ~= "commander" then board = "main" end
      table.insert(piles[board], card)
    end
  end
  local base = {x = pos.x + 2, y = pos.y + 2, z = pos.z}
  local name = data.name or "DeckApp deck"
  spawnPile(piles.main, name .. " library", base, true)
  spawnPile(piles.commander, name .. " commander", {x = base.x + 3.4, y = base.y, z = base.z}, false)
  spawnPile(piles.side, name .. " sideboard", {x = base.x - 3.4, y = base.y, z = base.z}, true)
  spawnPile(data.tokens, name .. " tokens", {x = base.x, y = base.y, z = base.z + 3.4}, false)
end
