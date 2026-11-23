-- DeckApp token viewer for Tabletop Simulator.
-- Paste this onto its own object. Select a pile, then click Add.
-- Cards line up A to Z, three at a time. Dragging one off leaves a copy.
-- Refresh downloads the latest copy of this script.

local SCRIPT_URL = "https://raw.githubusercontent.com/VicariousX/DeckApp/main/deckbuilder-frontend/public/tts/deckapp-token-viewer.lua"
local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Black"}
local VISIBLE = 3
local owner = ""
local order = {}
local known = {}
local released = {}
local scroll = 0
local busy = false

function hiddenFrom(color)
  if not color or color == "" then return {} end
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

function basis()
  local yaw = 0
  pcall(function() yaw = self.getRotation().y end)
  local forward = { x = 0, y = 0, z = 1 }
  local right = { x = 1, y = 0, z = 0 }
  local okF, f = pcall(function() return self.getTransformForward() end)
  local okR, r = pcall(function() return self.getTransformRight() end)
  if okF and f then forward = f end
  if okR and r then right = r end
  return forward, right, yaw
end

function claim(color)
  if color and color ~= "" and color ~= "Grey" then owner = color end
end

function cardName(guid)
  local obj = getObjectFromGUID(guid)
  if not obj then return "" end
  local name = ""
  pcall(function() name = obj.getName() or "" end)
  return name:lower()
end

function sortOrder()
  table.sort(order, function(a, b)
    local left = cardName(a)
    local right = cardName(b)
    if left == right then return a < b end
    return left < right
  end)
end

function onSave()
  return JSON.encode({ owner = owner })
end

function onLoad(saved)
  local raw = saved
  if not raw or raw == "" then raw = self.script_state end
  if raw and raw ~= "" then
    local data = JSON.decode(raw) or {}
    if data.owner then owner = data.owner end
  end
  self.setName("Token Viewer")
  self.setLock(true)
  self.setDescription("Select a pile, then click Add.")
  self.clearButtons()
  self.createButton({
    click_function = "viewPrev", function_owner = self, label = "<",
    position = {-0.85, 0.3, 0}, width = 220, height = 180, font_size = 100,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "viewNext", function_owner = self, label = ">",
    position = {0.85, 0.3, 0}, width = 220, height = 180, font_size = 100,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "addSelected", function_owner = self, label = "Add",
    position = {0, 0.3, 0.42}, width = 520, height = 180, font_size = 100,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "refreshScript", function_owner = self, label = "Refresh",
    position = {0, 0.3, -0.42}, width = 520, height = 160, font_size = 80,
    color = {0.18, 0.14, 0.28}, font_color = {0.94, 0.91, 1},
  })
end

function refreshScript()
  local who = owner ~= "" and owner or "White"
  broadcastToColor("Checking for a new token viewer...", who, {0.8, 0.8, 1})
  WebRequest.get(SCRIPT_URL .. "?t=" .. tostring(os.time()), function(req)
    if req.is_error or req.response_code ~= 200 then
      broadcastToColor("Refresh failed.", who, {1, 0.45, 0.4})
      return
    end
    local body = req.text or ""
    if not body:find("DeckApp token viewer for Tabletop Simulator", 1, true) then
      broadcastToColor("Refresh did not return the viewer. Nothing was changed.", who, {1, 0.55, 0.35})
      return
    end
    self.script_state = JSON.encode({ owner = owner })
    self.setLuaScript(body)
    broadcastToColor("Token viewer updated.", who, {0.7, 0.9, 0.7})
    self.reload()
  end)
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

function selectedObjects(color)
  local list = nil
  local okPlayer, player = pcall(function() return Player[color] end)
  if not okPlayer or not player or not player.getSelectedObjects then return {} end
  local ok, found = pcall(function() return player.getSelectedObjects() end)
  if ok and found then list = found end
  return list or {}
end

function addSelected(_, color)
  claim(color)
  if busy then return end
  local queue = {}
  for _, obj in ipairs(selectedObjects(color)) do
    if obj ~= self then
      local tag = safeTag(obj)
      if tag == "Card" or tag == "Deck" then table.insert(queue, obj) end
    end
  end
  if #queue == 0 then
    broadcastToColor("Select a pile or some cards, then click Add.", color, {1, 0.7, 0.4})
    return
  end
  busy = true
  local index = 1
  local function nextItem()
    if index > #queue then
      sortOrder()
      scroll = 0
      busy = false
      layout()
      return
    end
    local obj = queue[index]
    index = index + 1
    if safeTag(obj) == "Deck" then
      drain(obj, 0, nextItem)
    else
      adopt(obj)
      nextItem()
    end
  end
  nextItem()
end

function drain(obj, depth, done)
  depth = (depth or 0) + 1
  if depth > 80 or not obj then
    if done then done() end
    return
  end
  local tag = safeTag(obj)
  if tag == "Card" then
    adopt(obj)
    if done then done() end
    return
  end
  if tag ~= "Deck" then
    if done then done() end
    return
  end
  local guid = ""
  local anchor = self.getPosition()
  pcall(function() guid = obj.getGUID() end)
  pcall(function() anchor = obj.getPosition() end)
  local ok = pcall(function()
    obj.takeObject({
      smooth = false,
      flip = false,
      callback_function = function(card)
        adopt(card)
        Wait.time(function()
          local live = guid ~= "" and getObjectFromGUID(guid) or nil
          if live and safeTag(live) == "Deck" then
            drain(live, depth, done)
            return
          end
          if live and safeTag(live) == "Card" then adopt(live) end
          sweepNear(anchor)
          if done then done() end
        end, 0.08)
      end,
    })
  end)
  if not ok then
    sweepNear(anchor)
    if done then done() end
  end
end

function sweepNear(anchor)
  if not anchor then return end
  for _, obj in ipairs(getAllObjects()) do
    if safeTag(obj) == "Card" and obj ~= self then
      local pos = nil
      local ok = pcall(function() pos = obj.getPosition() end)
      if ok and pos then
        local dx = pos.x - anchor.x
        local dz = pos.z - anchor.z
        local dy = pos.y - anchor.y
        if dx * dx + dz * dz < 4 and dy * dy < 4 then adopt(obj) end
      end
    end
  end
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
  local forward, right, yaw = basis()
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
  local page = math.floor(scroll / VISIBLE) + 1
  local pages = math.max(1, math.ceil(#order / VISIBLE))
  pcall(function() self.setName("Token Viewer (" .. #order .. ")  " .. page .. "/" .. pages) end)
end

function releaseHeld(guid, index)
  local obj = getObjectFromGUID(guid)
  if not obj then return end
  local _, _, yaw = basis()
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

function viewPrev(_, color)
  claim(color)
  scroll = math.max(0, scroll - VISIBLE)
  layout()
end

function viewNext(_, color)
  claim(color)
  local maxScroll = math.max(0, #order - VISIBLE)
  scroll = math.min(maxScroll, scroll + VISIBLE)
  layout()
end
