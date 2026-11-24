-- DeckApp importer for Tabletop Simulator.
-- Paste this onto the importer object. Click Open Importer to open the panel.
-- Update inside the panel downloads the latest copy of this script.

local API = "https://deckapp-1.onrender.com/api/tts/"
local SCRIPT_URL = "https://raw.githubusercontent.com/VicariousX/DeckApp/main/deckbuilder-frontend/public/tts/deckapp-importer.lua"
local PLAIN_BACK = "https://backs.scryfall.io/large/0/a/0aeebaf5-8c7d-4636-9e82-8c27447861f7.jpg"

local decks = {}
local deckTotal = 0
local deckQuery = ""
local sleeves = {}
local selected = { id = "none", name = "None", url = "" }
local mode = "home"
local importUrl = ""
local uiColor = "White"
local seq = 2000
local shownAsset = "sleeveA"
local assetUrls = { sleeveA = PLAIN_BACK, sleeveB = PLAIN_BACK }
local artReady = false

function urlEncode(s)
  s = tostring(s or "")
  return (s:gsub("[^%w%-_%.~]", function(c)
    return string.format("%%%02X", string.byte(c))
  end))
end

function xmlEscape(s)
  s = tostring(s or ""):gsub("[%c]", " ")
  s = s:gsub("&", "&" .. "amp;")
  s = s:gsub("<", "&" .. "lt;")
  s = s:gsub(">", "&" .. "gt;")
  s = s:gsub('"', "&" .. "quot;")
  return s
end

function withCache(url)
  if not url or url == "" then return "" end
  if url:find("?", 1, true) then return url .. "&v=4" end
  return url .. "?v=4"
end

function sleeveRaw()
  if selected.url and selected.url ~= "" then return selected.url end
  return PLAIN_BACK
end

function sleeveImage()
  local url = sleeveRaw()
  if url == PLAIN_BACK then return url end
  return withCache(url)
end

function vadd(a, b, scale)
  scale = scale or 1
  return { x = a.x + b.x * scale, y = a.y + b.y * scale, z = a.z + b.z * scale }
end

function truncate(s, max)
  s = tostring(s or "")
  if #s <= max then return s end
  return s:sub(1, max - 1) .. "…"
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
  local old = { classic = true, arcane = true, night = true, parchment = true, ember = true, tide = true }
  if old[selected.id] then selected = { id = "none", name = "None", url = "" } end
  drawLauncher()
end

function drawLauncher()
  self.clearButtons()
  self.clearInputs()
  self.createButton({
    click_function = "openPanel",
    function_owner = self,
    label = "Open Importer",
    position = {0, 0.4, 0},
    width = 1600, height = 320, font_size = 120,
    color = {0.12, 0.09, 0.18},
    font_color = {0.94, 0.91, 1},
  })
end

function refreshScript()
  broadcastToAll("Checking for a new importer...", {0.8, 0.8, 1})
  WebRequest.get(SCRIPT_URL .. "?t=" .. tostring(os.time()), function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Refresh failed.", {1, 0.45, 0.4})
      return
    end
    local body = req.text or ""
    if not body:find("DeckApp importer for Tabletop Simulator", 1, true) then
      broadcastToAll("Refresh did not return the importer. Nothing was changed.", {1, 0.55, 0.35})
      return
    end
    self.script_state = JSON.encode({ sleeve = selected })
    self.setLuaScript(body)
    broadcastToAll("Importer updated.", {0.7, 0.9, 0.7})
    self.reload()
  end)
end

function openPanel(_, color)
  uiColor = color or "White"
  if mode == "" then mode = "home" end
  renderUI()
  refreshArt()
end

function uiClose()
  UI.setXml("")
end

function click(name)
  return self.getGUID() .. "/" .. name
end

function renderUI()
  local body = ""
  if mode == "sleeves" then
    body = sleeveList()
  elseif mode == "decks" then
    body = deckList()
  elseif mode == "url" then
    body = urlForm()
  else
    body = homeCopy()
  end
  local xml = [[
<Defaults>
  <Button class="btn" color="#2c2544" textColor="#f4f0ff" fontSize="20" minHeight="52" preferredHeight="52" flexibleHeight="0" />
  <Text class="label" color="#f4f0ff" fontSize="20" />
</Defaults>
<Panel id="deckapp" width="960" height="680" color="#14111cf2" rectAlignment="MiddleCenter" allowDragging="true" returnToOriginalPositionWhenReleased="false" visibility="]] .. uiColor .. [[">
  <Text class="label" fontSize="26" rectAlignment="UpperLeft" offsetXY="28 -18" width="420" height="36">DeckApp</Text>
  <Text class="label" fontSize="16" color="#b7aec9" rectAlignment="UpperLeft" offsetXY="28 -48" width="420" height="24">Sleeve · ]] .. xmlEscape(selected.name or "None") .. [[</Text>
  <Button class="btn" onClick="]] .. click("uiClose") .. [[" rectAlignment="UpperRight" offsetXY="-16 -16" width="40" height="40" fontSize="20" minHeight="40" preferredHeight="40">X</Button>
  <Image id="sleevePic" image="]] .. shownAsset .. [[" width="168" height="234" rectAlignment="UpperLeft" offsetXY="28 -88" />
  <Button class="btn" onClick="]] .. click("uiModeSleeves") .. [[" color="]] .. (mode == "sleeves" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -336" width="168" height="40" minHeight="40" preferredHeight="40">Sleeves</Button>
  <Button class="btn" onClick="]] .. click("uiModeDecks") .. [[" color="]] .. (mode == "decks" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -384" width="168" height="40" minHeight="40" preferredHeight="40">Decks</Button>
  <Button class="btn" onClick="]] .. click("uiModeUrl") .. [[" color="]] .. (mode == "url" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -432" width="168" height="40" minHeight="40" preferredHeight="40">Import URL</Button>
  <Button class="btn" onClick="]] .. click("uiUpdate") .. [[" rectAlignment="LowerLeft" offsetXY="28 24" width="168" height="40" minHeight="40" preferredHeight="40">Update</Button>
  ]] .. body .. [[
</Panel>]]
  UI.setXml(xml)
end

function refreshArt()
  local url = sleeveRaw()
  if artReady and assetUrls.sleeveA == url and assetUrls.sleeveB == url then return end
  assetUrls.sleeveA = url
  assetUrls.sleeveB = url
  pcall(function()
    UI.setCustomAssets({
      { name = "sleeveA", url = url },
      { name = "sleeveB", url = url },
    })
  end)
  Wait.time(function()
    shownAsset = "sleeveA"
    artReady = true
    renderUI()
  end, 0.45)
end

function rowButton(attrs, label)
  return '<Button class="btn" fontSize="20" minHeight="52" preferredHeight="52" flexibleHeight="0" height="52" ' .. attrs .. ">" .. xmlEscape(label) .. "</Button>"
end

function scrollRows(rows, top, viewHeight)
  local height = math.max(viewHeight, #rows * 60)
  return [[
<VerticalScrollView rectAlignment="UpperLeft" offsetXY="230 ]] .. top .. [[" width="690" height="]] .. viewHeight .. [[" color="#00000055" scrollSensitivity="40">
  <VerticalLayout spacing="8" padding="8" childAlignment="UpperCenter" childForceExpandWidth="true" childForceExpandHeight="false" childControlWidth="true" childControlHeight="true" height="]] .. height .. [[" preferredHeight="]] .. height .. [[">
    ]] .. table.concat(rows) .. [[
  </VerticalLayout>
</VerticalScrollView>]]
end

function homeCopy()
  return [[
<Text class="label" fontSize="20" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="240 -100" width="620" height="280">Decks has the public list. Import URL takes a DeckApp, Archidekt, Moxfield, MTGGoldfish, or Deckstats link. The sleeve on the left is the card back.

Tokens spawn in their own face-up pile. The token viewer is a separate object. Drop that pile onto it.</Text>]]
end

function sleeveList()
  if #sleeves == 0 then
    return [[<Text class="label" fontSize="20" rectAlignment="UpperLeft" offsetXY="240 -100" width="640" height="40">Loading sleeves…</Text>]]
  end
  local rows = {}
  for i, sleeve in ipairs(sleeves) do
    local mark = sleeve.id == selected.id and "   selected" or ""
    rows[#rows + 1] = rowButton('onClick="' .. click("uiPickSleeve") .. '" id="s' .. i .. '"', truncate(sleeve.name or "Sleeve", 48) .. mark)
  end
  return scrollRows(rows, "-88", 500)
end

function deckList()
  local rows = {}
  for i, deck in ipairs(decks) do
    local title = (deck.name or "Deck") .. "   " .. (deck.format or "")
    rows[#rows + 1] = rowButton('onClick="' .. click("uiPickDeck") .. '" id="d' .. i .. '"', truncate(title, 56))
  end
  if deckTotal == 0 and #decks == 0 then
    rows[#rows + 1] = '<Text class="label" minHeight="52" preferredHeight="52" height="52">No public decks.</Text>'
  elseif #decks < deckTotal then
    rows[#rows + 1] = rowButton('onClick="' .. click("uiMoreDecks") .. '"', "Load more (" .. #decks .. " / " .. deckTotal .. ")")
  end
  local list = scrollRows(rows, "-138", 450)
  return [[
<InputField id="deckSearch" onEndEdit="]] .. click("uiSearch") .. [[" placeholder="Search public decks" text="]] .. xmlEscape(deckQuery) .. [[" rectAlignment="UpperLeft" offsetXY="230 -88" width="690" height="44" fontSize="20" color="#221c33" textColor="#f4f0ff" />
]] .. list
end

function urlForm()
  return [[
<Text class="label" fontSize="18" rectAlignment="UpperLeft" offsetXY="240 -100" width="620" height="28">Paste a deck link</Text>
<InputField id="deckUrl" onValueChanged="]] .. click("uiUrl") .. [[" onEndEdit="]] .. click("uiUrl") .. [[" placeholder="https://" text="]] .. xmlEscape(importUrl) .. [[" rectAlignment="UpperLeft" offsetXY="230 -140" width="640" height="44" fontSize="16" color="#221c33" textColor="#f4f0ff" />
<Button class="btn" onClick="]] .. click("uiImport") .. [[" rectAlignment="UpperLeft" offsetXY="230 -200" width="220" height="44">Import</Button>
<Text class="label" fontSize="16" color="#b7aec9" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="240 -260" width="620" height="80">DeckApp, Archidekt, Moxfield, MTGGoldfish, and Deckstats. Chat: !deckapp and the link.</Text>]]
end

function uiUpdate()
  refreshScript()
end

function uiModeSleeves()
  mode = "sleeves"
  renderUI()
  if #sleeves > 0 then return end
  WebRequest.get(API .. "sleeves", function(req)
    sleeves = { { id = "none", name = "None", url = "" } }
    if not req.is_error and req.response_code == 200 then
      local data = JSON.decode(req.text)
      for _, sleeve in ipairs((data and data.sleeves) or {}) do
        table.insert(sleeves, sleeve)
      end
    else
      broadcastToAll("Sleeve list failed.", {1, 0.45, 0.4})
    end
    if mode == "sleeves" then renderUI() end
  end)
end

function uiModeDecks()
  mode = "decks"
  if #decks == 0 then
    decks = {}
    deckTotal = 0
    renderUI()
    fetchDeckChunk(function() if mode == "decks" then renderUI() end end)
    return
  end
  renderUI()
end

function uiModeUrl()
  mode = "url"
  renderUI()
end

function uiSearch(_, value)
  value = value or ""
  if value == deckQuery then return end
  deckQuery = value
  decks = {}
  deckTotal = 0
  fetchDeckChunk(function() if mode == "decks" then renderUI() end end)
end

function uiMoreDecks()
  fetchDeckChunk(function() if mode == "decks" then renderUI() end end)
end

function uiUrl(_, value)
  importUrl = value or ""
end

function uiPickSleeve(_, _, id)
  local index = tonumber((id or ""):match("%d+"))
  local sleeve = index and sleeves[index]
  if not sleeve then return end
  selected = { id = sleeve.id, name = sleeve.name, url = sleeve.url or "" }
  self.script_state = JSON.encode({ sleeve = selected })
  renderUI()
  refreshArt()
end

function uiPickDeck(player, _, id)
  local index = tonumber((id or ""):match("%d+"))
  local deck = index and decks[index]
  if not deck then return end
  local color = player and player.color or uiColor
  broadcastToAll("Loading " .. (deck.name or "deck") .. "…", {0.8, 0.8, 1})
  loadDeck(deck.id, seatSpot(color))
end

function uiImport(player)
  local typed = (importUrl or ""):gsub("^%s+", ""):gsub("%s+$", "")
  if typed == "" then
    broadcastToAll("Paste a deck URL first.", {1, 0.6, 0.4})
    return
  end
  local color = player and player.color or uiColor
  broadcastToAll("Importing with the " .. (selected.name or "None") .. " sleeve…", {0.8, 0.8, 1})
  local spot = seatSpot(color)
  WebRequest.get(API .. "import?url=" .. urlEncode(typed), function(req)
    if req.is_error or req.response_code ~= 200 then
      local data = JSON.decode(req.text or "")
      broadcastToAll("Import failed: " .. tostring((data and data.error) or req.error or req.text), {1, 0.4, 0.4})
      return
    end
    local data = JSON.decode(req.text)
    if data.missing and #data.missing > 0 then
      local names = table.concat(data.missing, ", ")
      if #names > 180 then names = names:sub(1, 177) .. "..." end
      broadcastToAll("Skipped " .. #data.missing .. " unrecognized cards: " .. names, {1, 0.7, 0.4})
    end
    spawnDeck(data, spot)
  end)
end

function fetchDeckChunk(done)
  if deckTotal > 0 and #decks >= deckTotal then
    if done then done() end
    return
  end
  local url = API .. "decks?limit=40&offset=" .. #decks .. "&q=" .. urlEncode(deckQuery)
  WebRequest.get(url, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck list failed.", {1, 0.4, 0.4})
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

function seatSpot(color)
  local fallback = self.getPosition()
  local spot = {
    origin = { x = fallback.x + 4, y = fallback.y + 2, z = fallback.z },
    forward = { x = 0, y = 0, z = 1 },
    right = { x = 1, y = 0, z = 0 },
    yaw = 0,
    color = color,
  }
  if not (color and Player[color]) then return spot end
  local ok, hand = pcall(function() return Player[color].getHandTransform() end)
  if not ok or not hand or not hand.position or not hand.forward or not hand.right then return spot end
  local depth = 12
  if hand.scale and hand.scale.z and hand.scale.z > 2 then
    depth = hand.scale.z * 0.5 + 6
  end
  spot.forward = hand.forward
  spot.right = hand.right
  spot.yaw = hand.rotation and hand.rotation.y or 0
  spot.origin = vadd(hand.position, hand.forward, depth)
  spot.origin.y = hand.position.y + 2
  return spot
end

function onChat(message, player)
  local raw = message:match("^!deckapp%s+(.+)$")
  if not raw then return end
  local color = player and player.color
  if raw:find("^https?://") then
    importUrl = raw
    uiImport(player)
    return false
  end
  local id = raw:match("([0-9a-fA-F%-]+)%s*$")
  if not id then return end
  loadDeck(id, seatSpot(color))
  return false
end

function loadDeck(id, spot)
  WebRequest.get(API .. "deck/" .. id, function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToAll("Deck load failed: " .. tostring(req.error or req.text), {1, 0.4, 0.4})
      return
    end
    spawnDeck(JSON.decode(req.text), spot)
  end)
end

function allocId()
  seq = seq + 1
  if seq > 9000 then seq = 2000 end
  return seq
end

function cardJson(name, face, position, rotation, tip)
  local id = allocId()
  return {
    Name = "Card",
    Transform = {
      posX = position.x, posY = position.y, posZ = position.z,
      rotX = rotation.x, rotY = rotation.y, rotZ = rotation.z,
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
      [tostring(id)] = {
        FaceURL = withCache(face),
        BackURL = sleeveImage(),
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
  return raw:sub(1, -2) .. ',"States":{"2":' .. JSON.encode(states["2"]) .. "}}"
end

function cardPayload(card, position, rotation)
  local frontName = card.name
  local frontFace = card.face
  local frontTip = card.tip or ""
  if card.faces and card.faces[1] then
    frontName = card.faces[1].name or frontName
    frontFace = card.faces[1].face or frontFace
    frontTip = card.faces[1].tip or frontTip
  end
  local payload = cardJson(frontName, frontFace, position, rotation, frontTip)
  if card.faces and card.faces[2] and card.faces[2].face then
    payload.States = {
      ["2"] = cardJson(
        card.faces[2].name or (frontName .. " back"),
        card.faces[2].face,
        position,
        rotation,
        card.faces[2].tip or ""
      ),
    }
  end
  return encodeCard(payload)
end

function alive(obj)
  if obj == nil then return false end
  local ok, dead = pcall(function() return obj.isDestroyed() end)
  return ok and not dead
end

function stackChunk(state)
  local deck = state.deck
  local last = math.min(#state.objs, state.i + 15)
  while state.i <= last do
    local obj = state.objs[state.i]
    state.i = state.i + 1
    if alive(obj) and obj ~= deck then
      if not alive(deck) then
        deck = obj
      else
        local ok, stacked = pcall(function() return deck.putObject(obj) end)
        if ok and alive(stacked) then deck = stacked end
      end
    end
  end
  state.deck = deck
  if state.i <= #state.objs then
    Wait.time(function() stackChunk(state) end, 0.2)
    return
  end
  if alive(deck) then
    pcall(function()
      deck.setName(state.name)
      deck.setPosition(state.position)
      deck.setRotation(state.rotation)
    end)
  end
  broadcastToAll(state.name .. " (" .. #state.objs .. ")", {0.75, 0.9, 0.75})
end

function stackIntoDeck(objs, name, position, rotation)
  if #objs == 0 then return end
  stackChunk({ objs = objs, name = name, position = position, rotation = rotation, i = 1, deck = nil })
end

function spawnPile(cards, name, position, rotation)
  if not cards or #cards == 0 then return end
  local objs = {}
  for _, card in ipairs(cards) do
    local qty = math.max(1, card.quantity or 1)
    for _ = 1, qty do
      local obj = nil
      local ok = pcall(function()
        obj = spawnObjectJSON({
          json = cardPayload(card, position, rotation),
          position = position,
          rotation = rotation,
          sound = false,
        })
      end)
      if ok and obj then table.insert(objs, obj) end
    end
  end
  Wait.time(function()
    stackIntoDeck(objs, name, position, rotation)
  end, 1.1)
end

function spawnDeck(data, spot)
  spot = spot or seatSpot(nil)
  local piles = { main = {}, side = {}, commander = {} }
  for _, card in ipairs(data.cards or {}) do
    local board = card.board or "main"
    if board ~= "maybe" then
      if board ~= "side" and board ~= "commander" then board = "main" end
      table.insert(piles[board], card)
    end
  end
  local name = data.name or "DeckApp deck"
  local yaw = spot.yaw or 0
  local faceDown = { x = 0, y = yaw, z = 180 }
  local faceUp = { x = 0, y = yaw, z = 0 }
  local library = spot.origin
  local commander = vadd(spot.origin, spot.right, 5)
  local side = vadd(spot.origin, spot.right, -5)
  local tokens = vadd(spot.origin, spot.forward, 5.5)
  commander.y = library.y
  side.y = library.y
  tokens.y = library.y
  spawnPile(piles.main, name .. " · Library", library, faceDown)
  spawnPile(piles.commander, name .. " · Commander", commander, faceUp)
  spawnPile(piles.side, name .. " · Sideboard", side, faceDown)
  spawnPile(data.tokens or {}, name .. " · Tokens", tokens, faceUp)
end
