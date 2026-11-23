-- DeckApp importer for Tabletop Simulator.
-- Paste onto an object. The selected sleeve is saved on the object.
-- Library and sideboard spawn face down. Commanders and tokens spawn face up.
-- Public decks page through the catalog. Import URL loads a DeckApp link
-- or a deck from Archidekt, Moxfield, MTGGoldfish, or Deckstats.
-- Hover text is the card's mana cost, type, and oracle text.

local API = "https://deckapp-1.onrender.com/api/tts/"
local decks = {}
local deckTotal = 0
local deckQuery = ""
local shown = {}
local sleeves = {}
local selected = { id = "none", name = "None", url = "" }
local mode = "home"
local page = 1
local importUrl = ""
local PAGE_SIZE = 8
local CHUNK = 40
local seq = 2000

function urlEncode(s)
  s = tostring(s or "")
  return (s:gsub("[^%w%-_%.~]", function(c)
    return string.format("%%%02X", string.byte(c))
  end))
end

function withCache(url)
  if not url or url == "" then return "" end
  if url:find("?", 1, true) then return url .. "&v=5" end
  return url .. "?v=5"
end

function sleeveUrl()
  if selected.url and selected.url ~= "" then
    return withCache(selected.url)
  end
  return API .. "back.jpg"
end

function onSave()
  return JSON.encode({ sleeve = selected })
end

function onLoad(saved)
  if saved and saved ~= "" then
    local data = JSON.decode(saved)
    local savedSleeve = data and (data.sleeve or data.skin)
    if savedSleeve and savedSleeve.id then selected = savedSleeve end
  end
  if selected.id == "classic" or selected.id == "arcane" or selected.id == "night"
    or selected.id == "parchment" or selected.id == "ember" or selected.id == "tide" then
    selected = { id = "none", name = "None", url = "" }
  end
  drawHome()
end

function truncate(s, max)
  s = s or ""
  if #s <= max then return s end
  return s:sub(1, max - 1) .. "…"
end

function drawHome()
  mode = "home"
  page = 1
  self.clearButtons()
  self.clearInputs()
  self.createButton({
    click_function = "openDecks",
    function_owner = self,
    label = "DeckApp",
    position = {0, 0.35, 0.55},
    rotation = {0, 0, 0},
    width = 1400, height = 280, font_size = 140,
    color = {0.16, 0.12, 0.24}, font_color = {0.93, 0.9, 1},
  })
  self.createButton({
    click_function = "openSleeves",
    function_owner = self,
    label = "Sleeve: " .. truncate(selected.name or "None", 16),
    position = {0, 0.35, 0},
    rotation = {0, 0, 0},
    width = 1400, height = 240, font_size = 100,
    color = {0.22, 0.16, 0.3}, font_color = {0.93, 0.9, 1},
  })
  self.createButton({
    click_function = "openUrl",
    function_owner = self,
    label = "Import URL",
    position = {0, 0.35, -0.5},
    rotation = {0, 0, 0},
    width = 1400, height = 240, font_size = 110,
    color = {0.18, 0.14, 0.28}, font_color = {0.93, 0.9, 1},
  })
end

function openSleeves()
  mode = "sleeves"
  page = 1
  broadcastToAll("Loading sleeves…", {0.8, 0.8, 1})
  WebRequest.get(API .. "sleeves", function(req)
    sleeves = { { id = "none", name = "None", url = "" } }
    if not req.is_error and req.response_code == 200 then
      local data = JSON.decode(req.text)
      for _, sleeve in ipairs((data and data.sleeves) or {}) do
        table.insert(sleeves, sleeve)
      end
    else
      broadcastToAll("Sleeve list failed (" .. tostring(req.response_code) .. ").", {1, 0.5, 0.4})
    end
    if #sleeves == 1 then
      broadcastToAll("No public sleeves yet. Upload some from Social → Sleeves.", {1, 0.7, 0.4})
    end
    drawSleeves()
  end)
end

function drawSleeves()
  shown = sleeves
  drawPaged("Back", function(item)
    local mark = item.id == selected.id and " *" or ""
    return truncate((item.name or item.id) .. mark, 28)
  end)
end

function openDecks()
  mode = "decks"
  page = 1
  decks = {}
  deckTotal = 0
  broadcastToAll("Loading public decks…", {0.8, 0.8, 1})
  fetchDeckChunk(function()
    if #decks == 0 then
      broadcastToAll("No public decks.", {1, 0.7, 0.4})
      drawHome()
      return
    end
    broadcastToAll("Sleeve: " .. (selected.name or "None") .. ". " .. deckTotal .. " public decks.", {0.6, 1, 0.6})
    showDecks()
  end)
end

function fetchDeckChunk(done)
  if deckTotal > 0 and #decks >= deckTotal then
    if done then done() end
    return
  end
  local url = API .. "decks?limit=" .. CHUNK .. "&offset=" .. #decks .. "&q=" .. urlEncode(deckQuery)
  WebRequest.get(url, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck list failed (" .. tostring(req.response_code) .. "): " .. tostring(req.error or req.text), {1, 0.4, 0.4})
      if done then done() end
      return
    end
    local data = JSON.decode(req.text) or {}
    local batch = data.decks or {}
    for _, deck in ipairs(batch) do table.insert(decks, deck) end
    deckTotal = tonumber(data.total) or #decks
    if #batch == 0 then deckTotal = #decks end
    if done then done() end
  end)
end

function showDecks()
  local need = page * PAGE_SIZE
  if #decks < need and #decks < deckTotal then
    fetchDeckChunk(function() drawGui(decks) end)
    return
  end
  drawGui(decks)
end

function drawGui(list)
  shown = list
  drawPaged("Close", function(item)
    return truncate((item.name or "Deck") .. " · " .. (item.format or ""), 30)
  end)
end

function drawPaged(closeLabel, labelFn)
  self.clearButtons()
  self.clearInputs()
  local total = #shown
  local pages = math.max(1, math.ceil((mode == "decks" and deckTotal or total) / PAGE_SIZE))
  if page > pages then page = pages end
  if page < 1 then page = 1 end
  local startIdx = (page - 1) * PAGE_SIZE + 1
  local endIdx = math.min(startIdx + PAGE_SIZE - 1, total)

  if mode == "decks" then
    self.createInput({
      input_function = "onDeckQuery",
      function_owner = self,
      label = "Search public decks",
      alignment = 3,
      position = {0, 0.36, 1.85},
      width = 1600, height = 170, font_size = 78,
      value = deckQuery,
    })
  end

  self.createButton({
    click_function = "closeGui",
    function_owner = self,
    label = closeLabel,
    position = {0, 0.35, 1.35},
    width = 1600, height = 220, font_size = 110,
    color = {0.28, 0.18, 0.32}, font_color = {0.93, 0.9, 1},
  })

  if pages > 1 then
    self.createButton({
      click_function = "prevPage", function_owner = self, label = "◀ Prev",
      position = {-0.7, 0.35, 0.9}, width = 700, height = 180, font_size = 90,
      color = {0.2, 0.15, 0.28}, font_color = {0.93, 0.9, 1},
    })
    self.createButton({
      click_function = "nextPage", function_owner = self, label = "Next ▶",
      position = {0.7, 0.35, 0.9}, width = 700, height = 180, font_size = 90,
      color = {0.2, 0.15, 0.28}, font_color = {0.93, 0.9, 1},
    })
    self.createButton({
      click_function = "noop", function_owner = self,
      label = page .. " / " .. pages,
      position = {0, 0.35, 0.9}, width = 500, height = 180, font_size = 90,
      color = {0.14, 0.1, 0.2}, font_color = {0.85, 0.82, 0.95},
    })
  end

  local names = {"pick1","pick2","pick3","pick4","pick5","pick6","pick7","pick8"}
  local slot = 1
  for i = startIdx, endIdx do
    if not names[slot] then break end
    self.createButton({
      click_function = names[slot],
      function_owner = self,
      label = labelFn(shown[i]),
      position = {0, 0.35, 0.4 - (slot - 1) * 0.46},
      width = 1800, height = 200, font_size = 90,
      color = {0.16, 0.12, 0.24}, font_color = {0.93, 0.9, 1},
    })
    slot = slot + 1
  end
end

function onDeckQuery(_, _, value, stillEditing)
  if stillEditing then return end
  value = value or ""
  if value == deckQuery then return end
  deckQuery = value
  page = 1
  decks = {}
  deckTotal = 0
  fetchDeckChunk(function() showDecks() end)
end

function prevPage()
  if page > 1 then
    page = page - 1
    if mode == "sleeves" then drawSleeves() else showDecks() end
  end
end

function nextPage()
  local total = mode == "decks" and deckTotal or #shown
  local pages = math.max(1, math.ceil(total / PAGE_SIZE))
  if page < pages then
    page = page + 1
    if mode == "sleeves" then drawSleeves() else showDecks() end
  end
end

function noop() end

function openUrl()
  mode = "url"
  self.clearButtons()
  self.clearInputs()
  self.createButton({
    click_function = "closeGui", function_owner = self, label = "Back",
    position = {0, 0.35, 1.15}, width = 1400, height = 220, font_size = 110,
    color = {0.28, 0.18, 0.32}, font_color = {0.93, 0.9, 1},
  })
  self.createInput({
    input_function = "onImportUrl",
    function_owner = self,
    label = "Paste a deck URL",
    alignment = 3,
    position = {0, 0.36, 0.45},
    width = 1800, height = 200, font_size = 70,
    value = importUrl,
  })
  self.createButton({
    click_function = "runImport", function_owner = self, label = "Import",
    position = {0, 0.35, -0.15}, width = 1400, height = 240, font_size = 120,
    color = {0.16, 0.12, 0.24}, font_color = {0.93, 0.9, 1},
  })
  self.createButton({
    click_function = "noop", function_owner = self,
    label = "Sleeve: " .. truncate(selected.name or "None", 22),
    position = {0, 0.35, -0.7}, width = 1400, height = 180, font_size = 80,
    color = {0.14, 0.1, 0.2}, font_color = {0.85, 0.82, 0.95},
  })
end

function onImportUrl(_, _, value, stillEditing)
  if stillEditing then return end
  importUrl = value or ""
end

function runImport(_, color)
  local inputs = self.getInputs()
  local typed = (inputs[1] and inputs[1].value) or importUrl
  typed = (typed or ""):gsub("^%s+", ""):gsub("%s+$", "")
  if typed == "" then
    broadcastToAll("Paste a deck URL first.", {1, 0.6, 0.4})
    return
  end
  importUrl = typed
  broadcastToAll("Importing with the " .. (selected.name or "None") .. " sleeve…", {0.8, 0.8, 1})
  local pos = playerPos(color)
  drawHome()
  WebRequest.get(API .. "import?url=" .. urlEncode(typed), function(req)
    if req.is_error or req.response_code ~= 200 then
      local data = JSON.decode(req.text or "")
      broadcastToAll("Import failed: " .. tostring((data and data.error) or req.error or req.text), {1, 0.4, 0.4})
      return
    end
    local data = JSON.decode(req.text)
    if data.missing and #data.missing > 0 then
      broadcastToAll("Skipped " .. #data.missing .. " unrecognized cards.", {1, 0.7, 0.4})
    end
    spawnDeck(data, pos)
  end)
end

function playerPos(color)
  if color and Player[color] then
    local ok, t = pcall(function() return Player[color].getHandTransform() end)
    if ok and t and t.position then
      local p = t.position
      return { x = p.x, y = p.y + 1.5, z = p.z - 1.5 }
    end
  end
  local p = self.getPosition()
  return { x = p.x + 2, y = p.y + 2, z = p.z }
end

function loadShown(index, color)
  local real = (page - 1) * PAGE_SIZE + index
  local chosen = shown[real]
  if not chosen then
    broadcastToAll("Nothing on that button.", {1, 0.5, 0.4})
    return
  end
  if mode == "sleeves" then
    selected = { id = chosen.id, name = chosen.name, url = chosen.url or "" }
    self.script_state = JSON.encode({ sleeve = selected })
    broadcastToAll("Sleeve set to " .. (selected.name or "None"), {0.6, 1, 0.6})
    drawHome()
    return
  end
  broadcastToAll("Loading " .. (chosen.name or "deck") .. "…", {0.8, 0.8, 1})
  local pos = playerPos(color)
  drawHome()
  loadDeck(chosen.id, pos)
end

function pick1(_, color) loadShown(1, color) end
function pick2(_, color) loadShown(2, color) end
function pick3(_, color) loadShown(3, color) end
function pick4(_, color) loadShown(4, color) end
function pick5(_, color) loadShown(5, color) end
function pick6(_, color) loadShown(6, color) end
function pick7(_, color) loadShown(7, color) end
function pick8(_, color) loadShown(8, color) end

function closeGui()
  drawHome()
end

function onChat(message, player)
  local raw = message:match("^!deckapp%s+(.+)$")
  if not raw then return end
  local color = player and player.color
  if raw:find("^https?://") then
    importUrl = raw
    runImport(nil, color)
    return false
  end
  local id = raw:match("([0-9a-fA-F%-]+)%s*$")
  if not id then return end
  loadDeck(id, playerPos(color))
  return false
end

function loadDeck(id, pos)
  broadcastToAll("Loading deck with the " .. (selected.name or "None") .. " sleeve…", {0.8, 0.8, 1})
  WebRequest.get(API .. "deck/" .. id, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck load failed: " .. tostring(req.error or req.text), {1, 0.4, 0.4})
      return
    end
    spawnDeck(JSON.decode(req.text), pos)
  end)
end

function allocId()
  seq = seq + 1
  if seq > 9000 then seq = 2000 end
  return seq
end

function cardJson(name, face, position, faceDown, tip)
  local id = allocId()
  local key = tostring(id)
  return {
    Name = "Card",
    Transform = {
      posX = position.x, posY = position.y, posZ = position.z,
      rotX = 0, rotY = 0, rotZ = faceDown and 180 or 0,
      scaleX = 1, scaleY = 1, scaleZ = 1,
    },
    Nickname = name or "Card",
    Description = tip or "",
    Locked = false,
    Grid = true,
    Snap = true,
    Sticky = true,
    Tooltip = true,
    Hands = true,
    HideWhenFaceDown = true,
    CardID = id * 100,
    SidewaysCard = false,
    CustomDeck = {
      [key] = {
        FaceURL = withCache(face),
        BackURL = sleeveUrl(),
        NumWidth = 1,
        NumHeight = 1,
        BackIsHidden = true,
        UniqueBack = true,
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
  local frontTip = card.tip or ""
  if card.faces and card.faces[1] then
    frontName = card.faces[1].name or frontName
    frontFace = card.faces[1].face or frontFace
    frontTip = card.faces[1].tip or frontTip
  end
  local payload = cardJson(frontName, frontFace, position, faceDown, frontTip)
  if card.faces and card.faces[2] and card.faces[2].face then
    local back = cardJson(
      card.faces[2].name or (frontName .. " back"),
      card.faces[2].face,
      position,
      faceDown,
      card.faces[2].tip or ""
    )
    payload.States = { ["2"] = back }
  end
  return encodeCard(payload)
end

function stackIntoDeck(objs, name, position)
  if #objs == 0 then return nil end
  local deck = objs[1]
  for i = 2, #objs do
    if objs[i] and objs[i].isDestroyed and not objs[i].isDestroyed() then
      local stacked = deck.putObject(objs[i])
      if stacked then deck = stacked end
    end
  end
  if deck and not (deck.isDestroyed and deck.isDestroyed()) then
    deck.setName(name)
    deck.setPosition(position)
    deck.setRotation({0, 0, 0})
  end
  return deck
end

function spawnPile(cards, name, position, faceDown)
  if not cards or #cards == 0 then return end
  local objs = {}
  for _, card in ipairs(cards) do
    local qty = math.max(1, card.quantity or 1)
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
    broadcastToAll("Spawned " .. name .. " (" .. #objs .. " cards)", {0.6, 1, 0.6})
  end, 1.2)
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
  local name = data.name or "DeckApp deck"
  spawnPile(piles.main, name .. " · Library", {x = pos.x, y = pos.y, z = pos.z}, true)
  spawnPile(piles.commander, name .. " · Commander", {x = pos.x + 4.5, y = pos.y, z = pos.z}, false)
  spawnPile(piles.side, name .. " · Sideboard", {x = pos.x - 4.5, y = pos.y, z = pos.z}, true)
  spawnPile(data.tokens, name .. " · Tokens", {x = pos.x, y = pos.y, z = pos.z + 4.5}, false)
end
