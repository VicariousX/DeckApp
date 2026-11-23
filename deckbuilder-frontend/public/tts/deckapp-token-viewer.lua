-- DeckApp token viewer for Tabletop Simulator.
-- Paste this onto its own object. It does not use the importer script.
-- Drop a token pile on it, or click Take pile. Dragging a card off leaves a copy.
-- The first player to use it is the only one who can see the stored faces.

local COLORS = {"White","Brown","Red","Orange","Yellow","Green","Teal","Blue","Purple","Pink","Black"}
local VISIBLE = 5
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
  self.setDescription("Drop a token pile on this object.")
  self.clearButtons()
  self.createButton({
    click_function = "viewPrev", function_owner = self, label = "<",
    position = {-0.7, 0.3, 0}, width = 240, height = 180, font_size = 100,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "viewNext", function_owner = self, label = ">",
    position = {0.7, 0.3, 0}, width = 240, height = 180, font_size = 100,
    color = {0.12, 0.09, 0.18}, font_color = {0.94, 0.91, 1},
  })
  self.createButton({
    click_function = "takeNearest", function_owner = self, label = "Take pile",
    position = {0, 0.3, 0.45}, width = 640, height = 180, font_size = 90,
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

function takeNearest(_, color)
  claim(color)
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
    local who = owner ~= "" and owner or color
    if who and who ~= "" then
      broadcastToColor("Move the token pile closer, then click Take pile.", who, {1, 0.7, 0.4})
    end
    return
  end
  intake(best)
end

function drain(obj, depth)
  depth = (depth or 0) + 1
  if depth > 80 then
    busy = false
    layout()
    return
  end
  local tag = safeTag(obj)
  if tag == "Card" then
    adopt(obj)
    busy = false
    layout()
    return
  end
  if tag ~= "Deck" then
    busy = false
    layout()
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
            drain(live, depth)
            return
          end
          if live and safeTag(live) == "Card" then
            adopt(live)
          end
          sweepNear(anchor)
          busy = false
          layout()
        end, 0.08)
      end,
    })
  end)
  if not ok then
    sweepNear(anchor)
    busy = false
    layout()
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
        if dx * dx + dz * dz < 4 and dy * dy < 4 then
          adopt(obj)
        end
      end
    end
  end
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
    drain(obj)
    return
  end
  if tag == "Card" then adopt(obj) end
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
  pcall(function() self.setName("Token Viewer (" .. #order .. ")") end)
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
