-- DeckApp importer for Tabletop Simulator.
-- Paste onto one object. Click DeckApp to open the panel.
-- The viewer stays quiet until a pile is dropped on it or Take pile is clicked.
-- Token viewer is a separate low pad. Drop the token pile on it.

local API = "https://deckapp-1.onrender.com/api/tts/"
local PLAIN_BACK = API .. "back.jpg"

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
  <Button class="btn" onClick="]] .. click("spawnViewer") .. [[" rectAlignment="UpperLeft" offsetXY="28 -480" width="168" height="40" minHeight="40" preferredHeight="40">Token viewer</Button>
  ]] .. body .. [[
</Panel>]]
  UI.setXml(xml)
end

function refreshArt()
  local url = sleeveRaw()
  if artReady and assetUrls[shownAsset] == url then return end
  local nxt = shownAsset == "sleeveA" and "sleeveB" or "sleeveA"
  assetUrls[nxt] = url
  pcall(function()
    UI.setCustomAssets({
      { name = "sleeveA", url = assetUrls.sleeveA },
      { name = "sleeveB", url = assetUrls.sleeveB },
    })
  end)
  Wait.time(function()
    shownAsset = nxt
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

Tokens spawn in their own pile, face up. Token viewer spawns a separate object. Drop token cards or that pile onto it. Dragging one back off copies it, so the viewer keeps the original. Only you can see the faces stored in the viewer.</Text>]]
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
local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Black"}
local VISIBLE = 5
local owner = "__OWNER__"
local right = {x = __RX__, y = 0, z = __RZ__}
local forward = {x = __FX__, y = 0, z = __FZ__}
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
  if data.forward then forward = data.forward end
  yaw = data.yaw or yaw
  self.setName("Token Viewer")
  self.setLock(true)
  self.setDescription("Drop the token pile on this pad.")
  self.createButton({
    click_function = "viewPrev", function_owner = self, label = "<",
    position = {-0.62, 0.22, 0}, width = 220, height = 160, font_size = 90,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "viewNext", function_owner = self, label = ">",
    position = {0.62, 0.22, 0}, width = 220, height = 160, font_size = 90,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "takeNearest", function_owner = self, label = "Take pile",
    position = {0, 0.35, 0}, width = 700, height = 220, font_size = 110,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
end

function safeTag(obj)
  if not obj then return "" end
  local tag = ""
  local ok = pcall(function() tag = obj.tag end)
  if not ok then return "" end
  return tag or ""
end

function heldBy(obj)
  local held = false
  pcall(function()
    local color = obj.held_by_color
    held = color ~= nil and color ~= ""
  end)
  return held
end

function onCollisionEnter(info)
  if busy or not info then return end
  local hit = info.collision_object
  if not hit or hit == self then return end
  local tag = safeTag(hit)
  if tag ~= "Card" and tag ~= "Deck" then return end
  Wait.time(function()
    if busy or heldBy(hit) then return end
    local liveTag = safeTag(hit)
    if liveTag == "Card" or liveTag == "Deck" then intake(hit) end
  end, 0.3)
end

function takeNearest()
  local origin = self.getPosition()
  local best = nil
  local bestD = 400
  for _, obj in ipairs(getAllObjects()) do
    local tag = safeTag(obj)
    if tag == "Deck" and obj ~= self then
      local name = ""
      pcall(function() name = obj.getName() or "" end)
      if name:find("Token", 1, true) then
        local pos = nil
        local ok = pcall(function() pos = obj.getPosition() end)
        if ok and pos then
          local dx = pos.x - origin.x
          local dz = pos.z - origin.z
          local dist = dx * dx + dz * dz
          if dist < bestD then
            best = obj
            bestD = dist
          end
        end
      end
    end
  end
  if not best then
    broadcastToColor("Move the token pile closer, then click Take pile.", owner, {1, 0.7, 0.4})
    return
  end
  intake(best)
end

function intake(obj)
  if not obj or busy then return end
  local guid = ""
  pcall(function() guid = obj.getGUID() end)
  if guid == "" or guid == self.getGUID() then return end
  if known[guid] or released[guid] then return end
  busy = true
  local tag = safeTag(obj)
  if tag == "Deck" then
    local guard = 0
    while guard < 80 and safeTag(obj) == "Deck" do
      guard = guard + 1
      local card = nil
      local ok = pcall(function() card = obj.takeObject({ smooth = false, flip = false }) end)
      if not ok or not card then break end
      adopt(card)
    end
    if safeTag(obj) == "Card" then adopt(obj) end
  elseif tag == "Card" then
    adopt(obj)
  end
  busy = false
  layout()
end

function adopt(obj)
  local guid = ""
  pcall(function() guid = obj.getGUID() end)
  if guid == "" or known[guid] or released[guid] or guid == self.getGUID() then return end
  if safeTag(obj) ~= "Card" then return end
  known[guid] = true
  table.insert(order, guid)
  pcall(function() obj.setLock(false) end)
  pcall(function() obj.setInvisibleTo(hiddenFrom(owner)) end)
end

function layout()
  local origin = self.getPosition()
  local shown = 0
  for i = scroll + 1, math.min(#order, scroll + VISIBLE) do
    if getObjectFromGUID(order[i]) then shown = shown + 1 end
  end
  local span = math.max(0, shown - 1) * 2.15
  local visual = 0
  for i, guid in ipairs(order) do
    local obj = getObjectFromGUID(guid)
    if obj and not heldBy(obj) then
      if i > scroll and i <= scroll + VISIBLE then
        visual = visual + 1
        local pos = vadd(origin, forward, 1.7)
        pos = vadd(pos, right, -span / 2 + (visual - 1) * 2.15)
        pos.y = origin.y + 0.35
        pcall(function()
          obj.setLock(false)
          obj.setPosition(pos)
          obj.setRotation({ x = 0, y = yaw, z = 0 })
          obj.setInvisibleTo(hiddenFrom(owner))
        end)
      else
        pcall(function()
          obj.setLock(true)
          obj.setPosition({ x = origin.x, y = origin.y - 12, z = origin.z })
          obj.setInvisibleTo(COLORS)
        end)
      end
    end
  end
  pcall(function() self.setName("Token Viewer (" .. #order .. ")") end)
end

function releaseHeld(guid, index)
  local obj = getObjectFromGUID(guid)
  if not obj then return end
  local pos = { x = 0, y = 2, z = 0 }
  pcall(function() pos = obj.getPosition() end)
  local copy = nil
  pcall(function()
    copy = obj.clone({ position = { x = pos.x, y = pos.y + 0.3, z = pos.z } })
  end)
  released[guid] = true
  known[guid] = nil
  pcall(function() obj.setInvisibleTo({}) end)
  if copy then
    local copyGuid = ""
    pcall(function() copyGuid = copy.getGUID() end)
    if copyGuid ~= "" then
      known[copyGuid] = true
      order[index] = copyGuid
      pcall(function()
        copy.setRotation({ x = 0, y = yaw, z = 0 })
        copy.setInvisibleTo(hiddenFrom(owner))
      end)
    end
  else
    table.remove(order, index)
  end
  layout()
end

function onUpdate()
  if #order == 0 then return end
  for i = #order, 1, -1 do
    local guid = order[i]
    local obj = getObjectFromGUID(guid)
    if not obj then
      table.remove(order, i)
      known[guid] = nil
    elseif heldBy(obj) then
      releaseHeld(guid, i)
    end
  end
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
  local pos = vadd(spot.origin, spot.right, -8)
  pos.y = (spot.origin.y or 2) + 0.1
  local yaw = spot.yaw or 0
  local rotation = { x = 0, y = yaw, z = 0 }
  local obj = spawnObjectJSON({
    json = cardPayload({ name = "Token Viewer", face = sleeveRaw(), tip = "Drop the token pile on this pad." }, pos, rotation),
    position = pos,
    rotation = rotation,
    sound = false,
  })
  if not obj then
    broadcastToAll("Token viewer failed to spawn.", {1, 0.4, 0.4})
    return
  end
  obj.setLock(true)
  obj.setScale({ x = 2.2, y = 1, z = 0.72 })
  obj.setName("Token Viewer")
  local lua = VIEWER_LUA
  lua = lua:gsub("__OWNER__", color)
  lua = lua:gsub("__RX__", tostring(spot.right.x or 1))
  lua = lua:gsub("__RZ__", tostring(spot.right.z or 0))
  lua = lua:gsub("__FX__", tostring(spot.forward.x or 0))
  lua = lua:gsub("__FZ__", tostring(spot.forward.z or 1))
  lua = lua:gsub("__YAW__", tostring(yaw))
  obj.script_state = JSON.encode({
    owner = color,
    right = spot.right,
    forward = spot.forward,
    yaw = yaw,
  })
  obj.setLuaScript(lua)
  broadcastToColor("Token viewer is to your left. Drop the token pile onto the pad.", color, {0.75, 0.85, 1})
end
