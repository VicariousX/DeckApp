-- DeckApp importer for Tabletop Simulator.
-- Paste onto one object. Click DeckApp to open the panel.
-- The selected sleeve is saved on the object.
-- Decks land on the table in front of the player who spawned them.
-- Library and sideboard are face down. Commanders are face up.
-- Tokens spawn in a floating tray only that player can see.
-- Dragging a token off the tray leaves the original and takes a copy.

local API = "https://deckapp-1.onrender.com/api/tts/"
local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Grey","Black"}
local VISIBLE = 5

local decks = {}
local deckTotal = 0
local deckQuery = ""
local sleeves = {}
local selected = { id = "none", name = "None", url = "" }
local mode = "home"
local importUrl = ""
local uiColor = "White"
local previewSerial = 0
local seq = 2000
local trays = {}
local anchors = {}

function urlEncode(s)
  s = tostring(s or "")
  return (s:gsub("[^%w%-_%.~]", function(c)
    return string.format("%%%02X", string.byte(c))
  end))
end

function xmlEscape(s)
  s = tostring(s or ""):gsub("[%c]", " ")
  return (s:gsub("&", "&"):gsub("<", "<"):gsub(">", ">"):gsub('"', """))
end

function withCache(url)
  if not url or url == "" then return "" end
  if url:find("?", 1, true) then return url .. "&v=6" end
  return url .. "?v=6"
end

function sleeveImage()
  if selected.url and selected.url ~= "" then return withCache(selected.url) end
  return API .. "back.jpg"
end

function hiddenFrom(owner)
  local list = {}
  for _, color in ipairs(COLORS) do
    if color ~= owner then table.insert(list, color) end
  end
  return list
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
    label = "DeckApp",
    position = {0, 0.35, 0},
    width = 1400, height = 360, font_size = 160,
    color = {0.12, 0.09, 0.18},
    font_color = {0.94, 0.91, 1},
  })
end

function openPanel(_, color)
  uiColor = color or "White"
  if mode == "home" or mode == "" then mode = "home" end
  renderUI()
end

function uiClose()
  UI.setXml("")
end

function click(name)
  return self.getGUID() .. "/" .. name
end

function renderUI()
  previewSerial = previewSerial + 1
  local asset = "sleeve" .. previewSerial
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
  <Button class="btn" color="#2c2544" textColor="#f4f0ff" fontSize="18" />
  <Text class="label" color="#f4f0ff" fontSize="18" />
</Defaults>
<Panel id="deckapp" width="900" height="620" color="#14111cf2" rectAlignment="MiddleCenter" allowDragging="true" returnToOriginalPositionWhenReleased="false" visibility="]] .. uiColor .. [[">
  <Text class="label" fontSize="26" rectAlignment="UpperLeft" offsetXY="28 -18" width="420" height="36">DeckApp</Text>
  <Text class="label" fontSize="16" color="#b7aec9" rectAlignment="UpperLeft" offsetXY="28 -48" width="420" height="24">Sleeve · ]] .. xmlEscape(selected.name or "None") .. [[</Text>
  <Button class="btn" onClick="]] .. click("uiClose") .. [[" rectAlignment="UpperRight" offsetXY="-16 -16" width="40" height="40" fontSize="20">✕</Button>
  <Image id="sleevePic" image="]] .. asset .. [[" width="168" height="234" rectAlignment="UpperLeft" offsetXY="28 -88" />
  <Button class="btn" onClick="]] .. click("uiModeSleeves") .. [[" color="]] .. (mode == "sleeves" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -336" width="168" height="40">Sleeves</Button>
  <Button class="btn" onClick="]] .. click("uiModeDecks") .. [[" color="]] .. (mode == "decks" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -384" width="168" height="40">Decks</Button>
  <Button class="btn" onClick="]] .. click("uiModeUrl") .. [[" color="]] .. (mode == "url" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -432" width="168" height="40">Import URL</Button>
  <Text class="label" fontSize="14" color="#b7aec9" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="28 -484" width="168" height="90">The preview is the back of every card spawned from here.</Text>
  ]] .. body .. [[
</Panel>]]
  UI.setXml(xml, {{ name = asset, url = sleeveImage() }})
end

function homeCopy()
  return [[
<Text class="label" fontSize="20" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="240 -100" width="620" height="220">Public decks are under Decks. Search is at the top of that list.

Import URL accepts a DeckApp link, or a deck from Archidekt, Moxfield, MTGGoldfish, or Deckstats. The sleeve on the left is applied either way.

Tokens come out in a tray only you can see. Drag one onto the table and the tray keeps its copy.</Text>]]
end

function sleeveList()
  if #sleeves == 0 then
    return [[<Text class="label" fontSize="18" rectAlignment="UpperLeft" offsetXY="240 -100" width="620" height="40">Loading sleeves…</Text>]]
  end
  local rows = {}
  for i, sleeve in ipairs(sleeves) do
    local mark = sleeve.id == selected.id and "  ·  selected" or ""
    rows[#rows + 1] = '<Button class="btn" onClick="' .. click("uiPickSleeve") .. '" id="s' .. i .. '" preferredHeight="42">' .. xmlEscape(truncate(sleeve.name or "Sleeve", 42) .. mark) .. "</Button>"
  end
  local height = math.max(80, #rows * 48)
  return [[
<VerticalScrollView rectAlignment="UpperLeft" offsetXY="230 -88" width="640" height="490" color="#00000055" scrollSensitivity="30">
  <VerticalLayout spacing="6" padding="8" childForceExpandWidth="true" childForceExpandHeight="false" childControlHeight="true" preferredHeight="]] .. height .. [[">
    ]] .. table.concat(rows) .. [[
  </VerticalLayout>
</VerticalScrollView>]]
end

function deckList()
  local rows = {}
  for i, deck in ipairs(decks) do
    rows[#rows + 1] = '<Button class="btn" onClick="' .. click("uiPickDeck") .. '" id="d' .. i .. '" preferredHeight="42">' .. xmlEscape(truncate((deck.name or "Deck") .. "  ·  " .. (deck.format or ""), 52)) .. "</Button>"
  end
  if deckTotal == 0 and #decks == 0 then
    rows[#rows + 1] = '<Text class="label" preferredHeight="36">No public decks.</Text>'
  elseif #decks < deckTotal then
    rows[#rows + 1] = '<Button class="btn" onClick="' .. click("uiMoreDecks") .. '" preferredHeight="42">Load more (' .. #decks .. " / " .. deckTotal .. ")</Button>"
  end
  local height = math.max(80, #rows * 48 + 8)
  return [[
<InputField id="deckSearch" onEndEdit="]] .. click("uiSearch") .. [[" placeholder="Search public decks" text="]] .. xmlEscape(deckQuery) .. [[" rectAlignment="UpperLeft" offsetXY="230 -88" width="640" height="40" fontSize="18" color="#221c33" textColor="#f4f0ff" />
<VerticalScrollView rectAlignment="UpperLeft" offsetXY="230 -138" width="640" height="440" color="#00000055" scrollSensitivity="30">
  <VerticalLayout spacing="6" padding="8" childForceExpandWidth="true" childForceExpandHeight="false" childControlHeight="true" preferredHeight="]] .. height .. [[">
    ]] .. table.concat(rows) .. [[
  </VerticalLayout>
</VerticalScrollView>]]
end

function urlForm()
  return [[
<Text class="label" fontSize="18" rectAlignment="UpperLeft" offsetXY="240 -100" width="620" height="28">Paste a deck link</Text>
<InputField id="deckUrl" onValueChanged="]] .. click("uiUrl") .. [[" onEndEdit="]] .. click("uiUrl") .. [[" placeholder="https://" text="]] .. xmlEscape(importUrl) .. [[" rectAlignment="UpperLeft" offsetXY="230 -140" width="640" height="44" fontSize="16" color="#221c33" textColor="#f4f0ff" />
<Button class="btn" onClick="]] .. click("uiImport") .. [[" rectAlignment="UpperLeft" offsetXY="230 -200" width="220" height="44">Import</Button>
<Text class="label" fontSize="16" color="#b7aec9" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="240 -260" width="620" height="120">DeckApp, Archidekt, Moxfield, MTGGoldfish, and Deckstats. A DeckApp link can be a deck that is not in the public list. Chat also works: !deckapp and the link.</Text>]]
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
      broadcastToAll("Skipped " .. #data.missing .. " unrecognized cards.", {1, 0.7, 0.4})
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

function cardJson(name, face, position, rotation, tip, floating)
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
    Grid = not floating,
    Snap = not floating,
    Sticky = not floating,
    Tooltip = true,
    Hands = not floating,
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
  return raw:sub(1, -2) .. ',"States":{"2":' .. JSON.encode(states["2"]) .. "}}"
end

function cardPayload(card, position, rotation, floating)
  local frontName = card.name
  local frontFace = card.face
  local frontTip = card.tip or ""
  if card.faces and card.faces[1] then
    frontName = card.faces[1].name or frontName
    frontFace = card.faces[1].face or frontFace
    frontTip = card.faces[1].tip or frontTip
  end
  local payload = cardJson(frontName, frontFace, position, rotation, frontTip, floating)
  if card.faces and card.faces[2] and card.faces[2].face then
    payload.States = {
      ["2"] = cardJson(
        card.faces[2].name or (frontName .. " back"),
        card.faces[2].face,
        position,
        rotation,
        card.faces[2].tip or "",
        floating
      ),
    }
  end
  return encodeCard(payload)
end

function stackIntoDeck(objs, name, position, rotation)
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
    deck.setRotation(rotation)
  end
  return deck
end

function spawnPile(cards, name, position, rotation)
  if not cards or #cards == 0 then return end
  local objs = {}
  for _, card in ipairs(cards) do
    local qty = math.max(1, card.quantity or 1)
    for _ = 1, qty do
      local obj = spawnObjectJSON({
        json = cardPayload(card, position, rotation),
        position = position,
        rotation = rotation,
        sound = false,
      })
      if obj then table.insert(objs, obj) end
    end
  end
  Wait.time(function()
    stackIntoDeck(objs, name, position, rotation)
    broadcastToAll(name .. " (" .. #objs .. ")", {0.75, 0.9, 0.75})
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
  commander.y = library.y
  side.y = library.y
  spawnPile(piles.main, name .. " · Library", library, faceDown)
  spawnPile(piles.commander, name .. " · Commander", commander, faceUp)
  spawnPile(piles.side, name .. " · Sideboard", side, faceDown)
  spawnTokenTray(data.tokens or {}, name, spot)
end

local TRAY_CARD_LUA = [[
function onPickUp(color)
  local data = JSON.decode(self.script_state or "")
  if not data or data.spent or color ~= data.owner then return end
  data.spent = true
  self.script_state = JSON.encode(data)
  local host = getObjectFromGUID(data.host)
  if host then host.call("releaseToken", data) end
  self.setInvisibleTo({})
  self.setLuaScript("")
end
]]

function chip(position, yaw, label, click, owner, trayGuid, dir)
  local obj = spawnObject({
    type = "Custom_Tile",
    position = position,
    rotation = { x = 0, y = yaw, z = 0 },
    scale = { 0.7, 0.7, 0.7 },
    sound = false,
  })
  if not obj then return nil end
  obj.setCustomObject({
    type = 2,
    image = sleeveImage(),
    image_bottom = sleeveImage(),
    thickness = 0.1,
    stackable = false,
  })
  obj.setLock(true)
  obj.setInvisibleTo(hiddenFrom(owner))
  obj.createButton({
    click_function = click,
    function_owner = self,
    label = label,
    position = {0, 0.25, 0},
    width = 700, height = 700, font_size = 280,
    color = {0.12, 0.09, 0.18},
    font_color = {0.94, 0.91, 1},
  })
  anchors[obj.getGUID()] = { tray = trayGuid, dir = dir, owner = owner }
  return obj
end

function trayNudge(object, color)
  local info = anchors[object.getGUID()]
  if not info or color ~= info.owner then return end
  scrollTray({ tray = info.tray, dir = info.dir })
end

function trayClose(object, color)
  local info = anchors[object.getGUID()]
  if not info or color ~= info.owner then return end
  dismissTray(info.tray)
end

function spawnTokenTray(tokens, name, spot)
  if not tokens or #tokens == 0 then return end
  local owner = spot.color or uiColor
  local anchor = vadd(spot.origin, spot.right, 13)
  anchor.y = (spot.origin.y or 2) + 1.8
  local trayGuid = self.getGUID() .. "-" .. tostring(os.time()) .. "-" .. tostring(math.random(1000, 9999))
  local tray = {
    guid = trayGuid,
    owner = owner,
    name = name,
    tokens = tokens,
    scroll = 0,
    anchor = anchor,
    forward = spot.forward,
    right = spot.right,
    yaw = spot.yaw or 0,
    slots = {},
    chips = {},
  }
  trays[trayGuid] = tray
  layTray(tray)
  broadcastToColor("Token tray is floating in front of you. Drag a token out to copy it.", owner, {0.75, 0.85, 1})
end

function visibleCount(tray)
  return math.min(VISIBLE, #tray.tokens)
end

function slotTransform(tray, index)
  local count = visibleCount(tray)
  local visual = index - tray.scroll
  local span = math.max(0, count - 1) * 2.45
  local along = -span / 2 + (visual - 1) * 2.45
  local p = vadd(tray.anchor, tray.right, along)
  p.y = tray.anchor.y
  return p, { x = 0, y = tray.yaw, z = 0 }
end

function layTray(tray)
  for guid in pairs(tray.slots) do
    local obj = getObjectFromGUID(guid)
    if obj then destroyObject(obj) end
  end
  tray.slots = {}
  for _, guid in ipairs(tray.chips) do
    local obj = getObjectFromGUID(guid)
    if obj then destroyObject(obj) end
    anchors[guid] = nil
  end
  tray.chips = {}
  local count = visibleCount(tray)
  for index = tray.scroll + 1, tray.scroll + count do
    spawnTrayCard(tray, index)
  end
  local span = math.max(0, count - 1) * 2.45
  local left = vadd(tray.anchor, tray.right, -span / 2 - 2.3)
  local rightPos = vadd(tray.anchor, tray.right, span / 2 + 2.3)
  left.y = tray.anchor.y
  rightPos.y = tray.anchor.y
  if #tray.tokens > VISIBLE then
    local prev = chip(left, tray.yaw, "◀", "trayNudge", tray.owner, tray.guid, -1)
    local nxt = chip(rightPos, tray.yaw, "▶", "trayNudge", tray.owner, tray.guid, 1)
    if prev then table.insert(tray.chips, prev.getGUID()) end
    if nxt then table.insert(tray.chips, nxt.getGUID()) end
  end
  local closePos = vadd(tray.anchor, tray.forward, -2.2)
  closePos.y = tray.anchor.y
  local closer = chip(closePos, tray.yaw, "✕", "trayClose", tray.owner, tray.guid, 0)
  if closer then table.insert(tray.chips, closer.getGUID()) end
end

function spawnTrayCard(tray, index)
  local card = tray.tokens[index]
  if not card then return end
  local position, rotation = slotTransform(tray, index)
  local obj = spawnObjectJSON({
    json = cardPayload(card, position, rotation, true),
    position = position,
    rotation = rotation,
    sound = false,
  })
  if not obj then return end
  local guid = obj.getGUID()
  tray.slots[guid] = index
  obj.setInvisibleTo(hiddenFrom(tray.owner))
  obj.setLuaScript(TRAY_CARD_LUA)
  obj.script_state = JSON.encode({
    host = self.getGUID(),
    tray = tray.guid,
    index = index,
    guid = guid,
    owner = tray.owner,
  })
  Wait.time(function()
    local live = getObjectFromGUID(guid)
    if live then live.setInvisibleTo(hiddenFrom(tray.owner)) end
  end, 0.4)
end

local freeing = {}

function releaseToken(args)
  if not args or freeing[args.guid] then return end
  freeing[args.guid] = true
  local tray = trays[args.tray]
  if not tray then return end
  tray.slots[args.guid] = nil
  spawnTrayCard(tray, args.index)
end

function scrollTray(args)
  local tray = trays[args.tray]
  if not tray then return end
  local nextScroll = tray.scroll + (args.dir or 0) * VISIBLE
  local maxScroll = math.max(0, #tray.tokens - VISIBLE)
  if nextScroll < 0 then nextScroll = 0 end
  if nextScroll > maxScroll then nextScroll = maxScroll end
  if nextScroll == tray.scroll then return end
  tray.scroll = nextScroll
  layTray(tray)
end

function dismissTray(trayGuid)
  local tray = trays[trayGuid]
  if not tray then return end
  for guid in pairs(tray.slots) do
    local obj = getObjectFromGUID(guid)
    if obj then destroyObject(obj) end
  end
  for _, guid in ipairs(tray.chips) do
    local obj = getObjectFromGUID(guid)
    if obj then destroyObject(obj) end
    anchors[guid] = nil
  end
  trays[trayGuid] = nil
end

function isHeld(obj)
  if obj.held_by_color and obj.held_by_color ~= "" then return true end
  local guid = obj.getGUID()
  for _, color in ipairs(COLORS) do
    local player = Player[color]
    if player and player.getHoldingObjects then
      local ok, held = pcall(function() return player.getHoldingObjects() end)
      if ok and held then
        for _, item in ipairs(held) do
          if item and item.getGUID() == guid then return true end
        end
      end
    end
  end
  return false
end

function onUpdate()
  local pulled = {}
  for _, tray in pairs(trays) do
    for guid, index in pairs(tray.slots) do
      local obj = getObjectFromGUID(guid)
      if obj and not (obj.isDestroyed and obj.isDestroyed()) then
        local position, rotation = slotTransform(tray, index)
        if isHeld(obj) then
          table.insert(pulled, { obj = obj, tray = tray.guid, guid = guid, index = index })
        else
          local p = obj.getPosition()
          local dx = p.x - position.x
          local dy = p.y - position.y
          local dz = p.z - position.z
          if dx * dx + dy * dy + dz * dz > 2.5 then
            table.insert(pulled, { obj = obj, tray = tray.guid, guid = guid, index = index })
          else
            obj.setPosition(position)
            obj.setRotation(rotation)
            pcall(function()
              obj.setVelocity({0, 0, 0})
              obj.setAngularVelocity({0, 0, 0})
            end)
          end
        end
      end
    end
  end
  for _, item in ipairs(pulled) do
    releaseToken({ tray = item.tray, guid = item.guid, index = item.index })
    pcall(function()
      item.obj.setInvisibleTo({})
      item.obj.setLuaScript("")
      item.obj.script_state = ""
    end)
  end
end
