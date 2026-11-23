-- DeckApp importer for Tabletop Simulator.
-- Paste onto one object. Click DeckApp to open the panel.
-- Token viewer is a separate object. Spawn it from the panel, then drop token cards onto it.
-- Decks land on the table in front of the player. Library and sideboard are face down.
-- Commanders and the token pile are face up.

local API = "https://deckapp-1.onrender.com/api/tts/"

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
  return API .. "back.jpg"
end

function sleeveImage()
  return withCache(sleeveRaw())
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
  if mode == "" then mode = "home" end
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
  <Button class="btn" onClick="]] .. click("uiClose") .. [[" rectAlignment="UpperRight" offsetXY="-16 -16" width="40" height="40" fontSize="20">X</Button>
  <Image id="sleevePic" image="]] .. asset .. [[" width="168" height="234" rectAlignment="UpperLeft" offsetXY="28 -88" />
  <Button class="btn" onClick="]] .. click("uiModeSleeves") .. [[" color="]] .. (mode == "sleeves" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -336" width="168" height="40">Sleeves</Button>
  <Button class="btn" onClick="]] .. click("uiModeDecks") .. [[" color="]] .. (mode == "decks" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -384" width="168" height="40">Decks</Button>
  <Button class="btn" onClick="]] .. click("uiModeUrl") .. [[" color="]] .. (mode == "url" and "#5b4588" or "#2c2544") .. [[" rectAlignment="UpperLeft" offsetXY="28 -432" width="168" height="40">Import URL</Button>
  <Button class="btn" onClick="]] .. click("spawnViewer") .. [[" rectAlignment="UpperLeft" offsetXY="28 -480" width="168" height="40">Token viewer</Button>
  ]] .. body .. [[
</Panel>]]
  local preview = sleeveRaw()
  pcall(function()
    UI.setCustomAssets({{ name = asset, url = preview }})
  end)
  UI.setXml(xml)
end

function homeCopy()
  return [[
<Text class="label" fontSize="20" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="240 -100" width="620" height="280">Decks has the public list. Import URL takes a DeckApp, Archidekt, Moxfield, MTGGoldfish, or Deckstats link. The sleeve on the left is the card back.

Tokens spawn in their own pile, face up. Token viewer spawns a separate object. Drop token cards or that pile onto it. Dragging one back off copies it, so the viewer keeps the original. Only you can see the faces stored in the viewer.</Text>]]
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
<Text class="label" fontSize="16" color="#b7aec9" alignment="UpperLeft" rectAlignment="UpperLeft" offsetXY="240 -260" width="620" height="80">DeckApp, Archidekt, Moxfield, MTGGoldfish, and Deckstats. Chat: !deckapp and the link.</Text>]]
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
  local tokens = vadd(spot.origin, spot.forward, 5.5)
  commander.y = library.y
  side.y = library.y
  tokens.y = library.y
  spawnPile(piles.main, name .. " · Library", library, faceDown)
  spawnPile(piles.commander, name .. " · Commander", commander, faceUp)
  spawnPile(piles.side, name .. " · Sideboard", side, faceDown)
  spawnPile(data.tokens or {}, name .. " · Tokens", tokens, faceUp)
end

local VIEWER_LUA = [=[
local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Grey","Black"}
local VISIBLE = 5
local owner = "__OWNER__"
local right = {x = __RX__, y = 0, z = __RZ__}
local yaw = __YAW__
local order = {}
local known = {}
local released = {}
local scroll = 0
local busy = false

function hiddenFrom(color)
  local list = {}
  for _, name in ipairs(COLORS) do
    if name ~= color then table.insert(list, name) end
  end
  return list
end

function allColors()
  local list = {}
  for _, name in ipairs(COLORS) do table.insert(list, name) end
  return list
end

function vadd(a, b, scale)
  scale = scale or 1
  return { x = a.x + b.x * scale, y = a.y + b.y * scale, z = a.z + b.z * scale }
end

function onLoad(saved)
  local raw = saved
  if not raw or raw == "" then raw = self.script_state end
  local data = {}
  if raw and raw ~= "" then data = JSON.decode(raw) or {} end
  owner = data.owner or owner
  if data.right then right = data.right end
  yaw = data.yaw or 0
  self.setName("Token Viewer")
  self.setLock(true)
  self.setDescription("Drop token cards here. Drag one off to copy it.")
  self.createButton({
    click_function = "viewPrev", function_owner = self, label = "<",
    position = {-1.6, 0.3, 0}, width = 500, height = 500, font_size = 250,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "viewNext", function_owner = self, label = ">",
    position = {1.6, 0.3, 0}, width = 500, height = 500, font_size = 250,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "noop", function_owner = self, label = "Drop tokens",
    position = {0, 0.3, 1.15}, width = 1400, height = 360, font_size = 160,
    color = {0.16, 0.12, 0.24}, font_color = {0.94, 0.91, 1},
  })
end

function noop() end

function onSave()
  return JSON.encode({ owner = owner, right = right, yaw = yaw })
end

function isHeld(obj)
  if not obj then return false end
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

function onCollisionEnter(info)
  local obj = info and info.collision_object
  if not obj or busy then return end
  if obj.getGUID() == self.getGUID() then return end
  if known[obj.getGUID()] or released[obj.getGUID()] then return end
  local hit = obj
  Wait.time(function()
    if not hit or (hit.isDestroyed and hit.isDestroyed()) then return end
    if isHeld(hit) or known[hit.getGUID()] then return end
    intake(hit)
  end, 0.35)
end

function intake(obj)
  if not obj or busy then return end
  if obj.getGUID() == self.getGUID() then return end
  if known[obj.getGUID()] or released[obj.getGUID()] then return end
  busy = true
  if obj.tag == "Deck" then
    local guard = 0
    while obj and not (obj.isDestroyed and obj.isDestroyed()) and obj.tag == "Deck" and guard < 80 do
      guard = guard + 1
      local card = obj.takeObject({ smooth = false, flip = false })
      if not card then break end
      adopt(card)
    end
    if obj and not (obj.isDestroyed and obj.isDestroyed()) and obj.tag == "Card" then
      adopt(obj)
    end
  elseif obj.tag == "Card" then
    adopt(obj)
  end
  busy = false
  layout()
end

function adopt(obj)
  if not obj or known[obj.getGUID()] or released[obj.getGUID()] then return end
  if obj.getGUID() == self.getGUID() then return end
  known[obj.getGUID()] = true
  table.insert(order, obj.getGUID())
  pcall(function() obj.setLock(false) end)
  obj.setInvisibleTo(hiddenFrom(owner))
end

function layout()
  local origin = self.getPosition()
  local shown = 0
  for i = scroll + 1, math.min(#order, scroll + VISIBLE) do
    if getObjectFromGUID(order[i]) then shown = shown + 1 end
  end
  local span = math.max(0, shown - 1) * 2.5
  local visual = 0
  for i, guid in ipairs(order) do
    local obj = getObjectFromGUID(guid)
    if obj and not (obj.isDestroyed and obj.isDestroyed()) then
      if i > scroll and i <= scroll + VISIBLE then
        visual = visual + 1
        local pos = vadd(origin, right, -span / 2 + (visual - 1) * 2.5)
        pos.y = origin.y + 0.7
        if not isHeld(obj) then
          obj.setLock(false)
          obj.setPosition(pos)
          obj.setRotation({ x = 0, y = yaw, z = 0 })
          obj.setInvisibleTo(hiddenFrom(owner))
          pcall(function()
            obj.setVelocity({0, 0, 0})
            obj.setAngularVelocity({0, 0, 0})
          end)
        end
      else
        obj.setLock(true)
        obj.setPosition({ x = origin.x, y = origin.y - 15, z = origin.z })
        obj.setInvisibleTo(allColors())
      end
    end
  end
  local label = "Tokens " .. #order
  if #order > VISIBLE then
    local page = math.floor(scroll / VISIBLE) + 1
    local pages = math.max(1, math.ceil(#order / VISIBLE))
    label = label .. "  " .. page .. "/" .. pages
  end
  pcall(function() self.editButton({ index = 2, label = label }) end)
end

function releaseHeld(guid, index)
  local obj = getObjectFromGUID(guid)
  if not obj then return end
  local pos = obj.getPosition()
  local rot = obj.getRotation()
  local copy = obj.clone({ position = { x = pos.x, y = pos.y + 0.2, z = pos.z } })
  released[guid] = true
  known[guid] = nil
  obj.setInvisibleTo({})
  if copy then
    known[copy.getGUID()] = true
    order[index] = copy.getGUID()
    copy.setRotation(rot)
    copy.setInvisibleTo(hiddenFrom(owner))
  else
    table.remove(order, index)
  end
end

function onUpdate()
  local pulled = {}
  for i, guid in ipairs(order) do
    local obj = getObjectFromGUID(guid)
    if obj and isHeld(obj) then
      table.insert(pulled, { guid = guid, index = i })
    end
  end
  for _, item in ipairs(pulled) do
    releaseHeld(item.guid, item.index)
  end
  if #pulled == 0 then layout() end
end

function viewPrev()
  scroll = math.max(0, scroll - VISIBLE)
  layout()
end

function viewNext()
  local maxScroll = math.max(0, #order - VISIBLE)
  scroll = math.min(maxScroll, scroll + VISIBLE)
  layout()
end
]=]

function spawnViewer(player)
  local color = (player and player.color) or uiColor or "White"
  local spot = seatSpot(color)
  local pos = vadd(spot.origin, spot.right, -11)
  pos.y = (spot.origin.y or 2) + 0.15
  local yaw = spot.yaw or 0
  local rotation = { x = 0, y = yaw, z = 0 }
  local obj = spawnObjectJSON({
    json = cardPayload({ name = "Token Viewer", face = sleeveRaw(), tip = "Drop token cards here." }, pos, rotation),
    position = pos,
    rotation = rotation,
    sound = false,
  })
  if not obj then
    broadcastToAll("Token viewer failed to spawn.", {1, 0.4, 0.4})
    return
  end
  obj.setLock(true)
  obj.setScale({ x = 6, y = 1, z = 2.4 })
  obj.setName("Token Viewer")
  local lua = VIEWER_LUA
  lua = lua:gsub("__OWNER__", color)
  lua = lua:gsub("__RX__", tostring(spot.right.x or 1))
  lua = lua:gsub("__RZ__", tostring(spot.right.z or 0))
  lua = lua:gsub("__YAW__", tostring(yaw))
  obj.script_state = JSON.encode({ owner = color, right = spot.right, yaw = yaw })
  obj.setLuaScript(lua)
  broadcastToColor("Token viewer is to your left. Drop the token pile onto it.", color, {0.75, 0.85, 1})
end
