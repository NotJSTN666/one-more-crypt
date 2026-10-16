--!nonstrict
-- One More Crypt client: draws the 7x7 crypt as a lit 3D board with voxel models built
-- from the web game's pixel art, plays the effects for each turn, and runs the menus.
-- All rules run on the server; this script sends inputs and draws what comes back.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")
local SoundService = game:GetService("SoundService")
local ContextActionService = game:GetService("ContextActionService")
local StarterGui = game:GetService("StarterGui")

local Shared = ReplicatedStorage:WaitForChild("OneMoreCrypt")
local Sprites = require(Shared:WaitForChild("Sprites"))
local Relics = require(Shared:WaitForChild("Relics"))
local Content = require(Shared:WaitForChild("Content"))
local Daily = require(Shared:WaitForChild("Daily"))
local Store = require(Shared:WaitForChild("Store"))
local remote: RemoteFunction = Shared:WaitForChild("Crypt")
local pushEvent: RemoteEvent = Shared:WaitForChild("CryptPush")
local MarketplaceService = game:GetService("MarketplaceService")
local presence: IntValue = Shared:WaitForChild("SoulsInCrypt")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera

-- No avatar in this game: switch off the default movement controls and backpack.
task.spawn(function()
	local ok, module = pcall(function()
		return require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule", 10) :: any)
	end)
	if ok and module then
		module:GetControls():Disable()
	end
end)
pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
end)

local W, H = 7, 7
local TILE = 4
local PIX = TILE * 0.9 / 12
-- Figures lean back toward the camera so they don't look squashed from above.
local LEAN = math.rad(36)
local ORIGIN = Vector3.new(0, 200, 0)

local C = {
	bg = Color3.fromRGB(7, 4, 11),
	panel = Color3.fromRGB(20, 13, 28),
	panel2 = Color3.fromRGB(32, 22, 44),
	line = Color3.fromRGB(70, 52, 92),
	text = Color3.fromRGB(232, 220, 196),
	dim = Color3.fromRGB(154, 163, 181),
	gold = Color3.fromRGB(242, 193, 78),
	red = Color3.fromRGB(210, 58, 70),
	green = Color3.fromRGB(126, 224, 129),
	ice = Color3.fromRGB(159, 232, 255),
	floorA = Color3.fromRGB(58, 48, 72),
	floorB = Color3.fromRGB(50, 41, 62),
	wall = Color3.fromRGB(78, 68, 95),
	wallTop = Color3.fromRGB(108, 96, 128),
}

local HEADING = Enum.Font.Arcade
local BODY = Enum.Font.GothamMedium
local BOLD = Enum.Font.GothamBold

local function tilePos(x: number, y: number): Vector3
	return ORIGIN + Vector3.new((x - 3) * TILE, 0, (y - 3) * TILE)
end

-- ---------- atmosphere ----------

Lighting.Ambient = Color3.fromRGB(95, 82, 120)
Lighting.OutdoorAmbient = Color3.fromRGB(40, 32, 56)
Lighting.Brightness = 0.4
Lighting.ClockTime = 0
Lighting.FogColor = C.bg
Lighting.FogStart = 60
Lighting.FogEnd = 220
Lighting.GlobalShadows = true
for _, child in Lighting:GetChildren() do
	if child:IsA("Sky") or child:IsA("Atmosphere") then
		child:Destroy()
	end
end
local bloom = Instance.new("BloomEffect")
bloom.Intensity = 0.6
bloom.Size = 18
bloom.Threshold = 0.9
bloom.Parent = Lighting
local grade = Instance.new("ColorCorrectionEffect")
grade.Contrast = 0.12
grade.Saturation = 0.05
grade.TintColor = Color3.fromRGB(255, 240, 250)
grade.Parent = Lighting

local function sound(id: string, volume: number?, pitch: number?)
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume or 0.5
	s.PlaybackSpeed = pitch or 1
	s.Parent = SoundService
	s:Play()
	Debris:AddItem(s, 3)
end
local SFX = {
	swing = "rbxasset://sounds/swordslash.wav",
	lunge = "rbxasset://sounds/swordlunge.wav",
	death = "rbxasset://sounds/uuhhh.mp3",
	pick = "rbxasset://sounds/electronicpingshort.wav",
	click = "rbxasset://sounds/button.wav",
}

-- ---------- world folders ----------

local world = Instance.new("Folder")
world.Name = "Crypt"
world.Parent = workspace
local boardFolder = Instance.new("Folder")
boardFolder.Name = "Board"
boardFolder.Parent = world
local unitFolder = Instance.new("Folder")
unitFolder.Name = "Units"
unitFolder.Parent = world
local fxFolder = Instance.new("Folder")
fxFolder.Name = "Effects"
fxFolder.Parent = world
local markFolder = Instance.new("Folder")
markFolder.Name = "Marks"
markFolder.Parent = world

local function part(props): BasePart
	local p = Instance.new(props.Class or "Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = props.CanQuery == true
	p.CanTouch = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = props.Material or Enum.Material.SmoothPlastic
	for k, v in props do
		if k ~= "Class" and k ~= "Material" and k ~= "CanQuery" then
			p[k] = v
		end
	end
	return p
end

-- A dark void under the crypt, so the board floats in the dark.
part({
	Size = Vector3.new(400, 1, 400),
	CFrame = CFrame.new(ORIGIN - Vector3.new(0, 6, 0)),
	Color = Color3.fromRGB(5, 3, 8),
	CanCollide = true,
	Parent = world,
})

-- ---------- voxel models ----------

local function shade(c: Color3, amt: number): Color3
	if amt > 0 then
		return c:Lerp(Color3.new(1, 1, 1), amt)
	end
	return c:Lerp(Color3.new(0, 0, 0), -amt)
end

--- Build a 12x12 sprite as a voxel model standing on the ground, facing the camera.
--- Same-coloured runs in a row are merged into one part.
local function buildVoxel(rows: { string }, colors: { [string]: Color3 }, lit: boolean?): (Model, BasePart)
	local model = Instance.new("Model")
	local root = part({ Size = Vector3.new(0.2, 0.2, 0.2), Transparency = 1, Name = "Root" })
	root.Parent = model
	model.PrimaryPart = root
	local depth = PIX * 2
	local function colorAt(x: number, y: number): Color3?
		local row = rows[y]
		if not row then
			return nil
		end
		local ch = string.sub(row, x, x)
		if ch == "." or ch == "" then
			return nil
		end
		local c = colors[ch] or Sprites.PALETTE[ch] or Color3.new(1, 0, 1)
		if lit and ch ~= "k" and ch ~= "w" and ch ~= "e" then
			-- Light from above, as the web renderer does.
			local function edge(cx, cy)
				local r = rows[cy]
				local e = if r then string.sub(r, cx, cx) else "."
				return e == "." or e == "k" or e == ""
			end
			local top = edge(x, y - 1)
			local bottom = edge(x, y + 1) or edge(x + 1, y)
			if top and not bottom then
				c = shade(c, 0.22)
			elseif bottom and not top then
				c = shade(c, -0.22)
			end
		end
		return c
	end
	for y = 1, 12 do
		local x = 1
		while x <= 12 do
			local c = colorAt(x, y)
			if c then
				local x2 = x
				while x2 < 12 and colorAt(x2 + 1, y) == c do
					x2 += 1
				end
				local n = x2 - x + 1
				local p = part({
					Size = Vector3.new(PIX * n, PIX, depth),
					Color = c,
					Material = if c == Sprites.PALETTE.e or c == Sprites.PALETTE.y then Enum.Material.Neon else Enum.Material.SmoothPlastic,
					Anchored = false,
				})
				p.CFrame = CFrame.new(((x + x2) / 2 - 6.5) * PIX, (12.5 - y) * PIX, 0)
				p.Parent = model
				x = x2 + 1
			else
				x += 1
			end
		end
	end
	for _, p in model:GetChildren() do
		if p ~= root and p:IsA("BasePart") then
			local weld = Instance.new("WeldConstraint")
			weld.Part0 = root
			weld.Part1 = p
			weld.Parent = p
		end
	end
	return model, root
end

-- ---------- floating text, beams and particles ----------

local function anchorAt(pos: Vector3, life: number): BasePart
	local a = part({ Size = Vector3.new(0.1, 0.1, 0.1), Transparency = 1, CFrame = CFrame.new(pos), Parent = fxFolder })
	Debris:AddItem(a, life)
	return a
end

local function floater(x: number, y: number, text: string, color: Color3, size: number?)
	local a = anchorAt(tilePos(x, y) + Vector3.new(math.random() - 0.5, 3.4, 0), 1.4)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(160, 50)
	gui.AlwaysOnTop = true
	gui.LightInfluence = 0
	gui.Parent = a
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Font = HEADING
	label.Text = text
	label.TextColor3 = color
	label.TextScaled = false
	label.TextSize = 26 * (size or 1)
	label.TextStrokeTransparency = 0
	label.TextStrokeColor3 = Color3.new(0, 0, 0)
	label.Parent = gui
	TweenService:Create(gui, TweenInfo.new(1.1, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { StudsOffset = Vector3.new(0, 2.2, 0) }):Play()
	TweenService:Create(label, TweenInfo.new(0.5, Enum.EasingStyle.Linear, Enum.EasingDirection.In, 0, false, 0.6), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
end

local function burst(pos: Vector3, color: Color3, count: number, speed: number?)
	local a = anchorAt(pos, 2)
	local att = Instance.new("Attachment")
	att.Parent = a
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(color)
	pe.LightEmission = 0.6
	pe.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.35), NumberSequenceKeypoint.new(1, 0) })
	pe.Speed = NumberRange.new(4 * (speed or 1), 10 * (speed or 1))
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.Lifetime = NumberRange.new(0.3, 0.7)
	pe.Acceleration = Vector3.new(0, -20, 0)
	pe.Drag = 3
	pe.Rate = 0
	pe.Shape = Enum.ParticleEmitterShape.Box
	pe.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	pe.Parent = att
	pe:Emit(count)
end

local function beam(from: Vector3, to: Vector3, color: Color3, life: number, width: number?)
	local mid = (from + to) / 2
	local len = (to - from).Magnitude
	if len < 0.01 then
		return
	end
	local b = part({
		Size = Vector3.new(width or 0.25, width or 0.25, len),
		CFrame = CFrame.lookAt(mid, to),
		Color = color,
		Material = Enum.Material.Neon,
		Parent = fxFolder,
	})
	TweenService:Create(b, TweenInfo.new(life), { Transparency = 1, Size = Vector3.new(0.05, 0.05, len) }):Play()
	Debris:AddItem(b, life + 0.1)
end

-- ---------- camera ----------

local shakeUntil, shakeAmp = 0, 0
local function shake(amp: number, dur: number)
	shakeAmp = math.max(shakeAmp, amp)
	shakeUntil = math.max(shakeUntil, os.clock() + dur)
end

local function baseCameraCFrame(): CFrame
	local vp = camera.ViewportSize
	local aspect = vp.X / math.max(1, vp.Y)
	local vfov = math.rad(camera.FieldOfView)
	local hfov = 2 * math.atan(math.tan(vfov / 2) * aspect)
	local needW = W * TILE + 6
	local needH = H * TILE + 14
	local dist = math.max((needW / 2) / math.tan(hfov / 2), (needH / 2) / math.tan(vfov / 2))
	local pitch = math.rad(52)
	local target = ORIGIN + Vector3.new(0, 1, 1.2)
	local eye = target + Vector3.new(0, math.sin(pitch), math.cos(pitch)) * dist
	return CFrame.lookAt(eye, target)
end

camera.CameraType = Enum.CameraType.Scriptable
camera.FieldOfView = 45
RunService:BindToRenderStep("CryptCamera", Enum.RenderPriority.Camera.Value + 1, function()
	camera.CameraType = Enum.CameraType.Scriptable
	local cf = baseCameraCFrame()
	if os.clock() < shakeUntil then
		local a = shakeAmp
		cf *= CFrame.new((math.random() - 0.5) * a, (math.random() - 0.5) * a, 0)
	else
		shakeAmp = 0
	end
	camera.CFrame = cf
end)

-- ---------- the board ----------

local board = {
	floor = -1,
	mode = "",
	tiles = {}, -- [idx] = floor part, for tap raycasts
	stairs = nil,
	stairsLight = nil,
	grate = nil,
	potion = nil,
	feature = nil,
}

local function clearFolder(f: Instance)
	for _, c in f:GetChildren() do
		c:Destroy()
	end
end

local function torch(pos: Vector3)
	local post = part({ Size = Vector3.new(0.5, 3, 0.5), CFrame = CFrame.new(pos), Color = Color3.fromRGB(60, 40, 30), Parent = boardFolder })
	local flame = part({
		Size = Vector3.new(0.7, 0.9, 0.7),
		CFrame = CFrame.new(pos + Vector3.new(0, 1.9, 0)),
		Color = Color3.fromRGB(255, 150, 60),
		Material = Enum.Material.Neon,
		Parent = boardFolder,
	})
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 160, 90)
	light.Range = 22
	light.Brightness = 1.2
	light.Shadows = true
	light.Parent = flame
	local fire = Instance.new("Fire")
	fire.Size = 2
	fire.Heat = 4
	fire.Color = Color3.fromRGB(255, 140, 50)
	fire.SecondaryColor = Color3.fromRGB(255, 60, 30)
	fire.Parent = flame
	return post
end

local FEATURE_STYLE = {
	shrine = { base = Color3.fromRGB(58, 51, 70), glow = Color3.fromRGB(210, 58, 70), emoji = "🩸" },
	chest = { base = Color3.fromRGB(122, 85, 50), glow = Color3.fromRGB(242, 193, 78), emoji = "🧰" },
	fountain = { base = Color3.fromRGB(75, 66, 89), glow = Color3.fromRGB(159, 232, 255), emoji = "⛲" },
	forge = { base = Color3.fromRGB(40, 36, 52), glow = Color3.fromRGB(127, 180, 255), emoji = "⚒️" },
}

local function buildFeature(f)
	local style = FEATURE_STYLE[f.kind]
	local model = Instance.new("Model")
	model.Name = "Feature"
	local pos = tilePos(f.x, f.y)
	if f.kind == "chest" then
		part({ Size = Vector3.new(2.6, 1.6, 1.8), CFrame = CFrame.new(pos + Vector3.new(0, 0.8, 0)), Color = style.base, Material = Enum.Material.Wood, Parent = model })
		part({ Size = Vector3.new(2.7, 0.3, 1.9), CFrame = CFrame.new(pos + Vector3.new(0, 1.2, 0)), Color = Color3.fromRGB(93, 102, 122), Material = Enum.Material.Metal, Parent = model })
		part({ Name = "Glow", Size = Vector3.new(0.5, 0.5, 0.2), CFrame = CFrame.new(pos + Vector3.new(0, 1.0, 0.95)), Color = style.glow, Material = Enum.Material.Neon, Parent = model })
	elseif f.kind == "fountain" then
		part({ Size = Vector3.new(3, 1, 3), CFrame = CFrame.new(pos + Vector3.new(0, 0.5, 0)), Color = style.base, Material = Enum.Material.Slate, Parent = model })
		part({ Name = "Glow", Size = Vector3.new(2.4, 0.2, 2.4), CFrame = CFrame.new(pos + Vector3.new(0, 1.0, 0)), Color = style.glow, Material = Enum.Material.Neon, Transparency = 0.2, Parent = model })
	elseif f.kind == "forge" then
		part({ Size = Vector3.new(1.4, 1, 1.4), CFrame = CFrame.new(pos + Vector3.new(0, 0.5, 0)), Color = style.base, Material = Enum.Material.Metal, Parent = model })
		part({ Size = Vector3.new(2.6, 0.6, 1.2), CFrame = CFrame.new(pos + Vector3.new(0, 1.3, 0)), Color = Color3.fromRGB(70, 70, 84), Material = Enum.Material.Metal, Parent = model })
		part({ Name = "Glow", Size = Vector3.new(0.8, 0.8, 0.8), CFrame = CFrame.new(pos + Vector3.new(0, 2.1, 0)), Color = style.glow, Material = Enum.Material.Neon, Parent = model })
	else
		part({ Size = Vector3.new(2.2, 1.8, 2.2), CFrame = CFrame.new(pos + Vector3.new(0, 0.9, 0)), Color = style.base, Material = Enum.Material.Slate, Parent = model })
		part({ Name = "Glow", Size = Vector3.new(1.8, 0.2, 1.8), CFrame = CFrame.new(pos + Vector3.new(0, 1.9, 0)), Color = style.glow, Material = Enum.Material.Neon, Parent = model })
	end
	local glow = model:FindFirstChild("Glow")
	local light = Instance.new("PointLight")
	light.Color = style.glow
	light.Range = 10
	light.Brightness = 2
	light.Parent = glow
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(40, 40)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 3.6, 0)
	gui.LightInfluence = 0
	gui.Parent = glow
	local label = Instance.new("TextLabel")
	label.BackgroundTransparency = 1
	label.Size = UDim2.fromScale(1, 1)
	label.Text = style.emoji
	label.TextScaled = true
	label.Parent = gui
	model.Parent = boardFolder
	return model
end

local function setFeatureUsed(model: Model, used: boolean)
	local glow = model:FindFirstChild("Glow")
	if not glow then
		return
	end
	glow.Material = if used then Enum.Material.SmoothPlastic else Enum.Material.Neon
	if used then
		glow.Color = Color3.fromRGB(60, 56, 70)
	end
	local light = glow:FindFirstChildOfClass("PointLight")
	if light then
		light.Enabled = not used
	end
	local gui = glow:FindFirstChildOfClass("BillboardGui")
	if gui then
		gui.Enabled = not used
	end
end

local function buildBoard(state)
	clearFolder(boardFolder)
	board.tiles = {}
	board.floor = state.floor
	local walls, spikes = {}, {}
	for _, i in state.walls do
		walls[i] = true
	end
	for _, i in state.spikes do
		spikes[i] = true
	end
	local boss = state.boss
	for y = 0, H - 1 do
		for x = 0, W - 1 do
			local i = y * W + x
			local pos = tilePos(x, y)
			local isStairs = x == state.stairs.x and y == state.stairs.y
			if walls[i] then
				part({ Size = Vector3.new(TILE, TILE * 0.8, TILE), CFrame = CFrame.new(pos + Vector3.new(0, TILE * 0.4 - 0.5, 0)), Color = C.wall, Material = Enum.Material.Slate, CanCollide = true, Parent = boardFolder })
				part({ Size = Vector3.new(TILE, 0.3, TILE), CFrame = CFrame.new(pos + Vector3.new(0, TILE * 0.8 - 0.35, 0)), Color = C.wallTop, Material = Enum.Material.Slate, Parent = boardFolder })
			elseif isStairs then
				local pit = part({ Size = Vector3.new(TILE, 1, TILE), CFrame = CFrame.new(pos - Vector3.new(0, 2.5, 0)), Color = Color3.fromRGB(4, 2, 6), CanQuery = true, Parent = boardFolder })
				board.tiles[i] = pit
				for s = 1, 3 do
					part({ Size = Vector3.new(TILE * 0.8, 0.5, TILE * 0.25), CFrame = CFrame.new(pos + Vector3.new(0, -0.5 * s, -TILE * 0.35 + s * TILE * 0.22)), Color = Color3.fromRGB(28, 22, 36), Material = Enum.Material.Slate, Parent = boardFolder })
				end
				board.grate = Instance.new("Model")
				for b = -2, 2 do
					part({ Size = Vector3.new(0.25, 0.25, TILE), CFrame = CFrame.new(pos + Vector3.new(b * TILE * 0.2, -0.1, 0)), Color = Color3.fromRGB(93, 102, 122), Material = Enum.Material.Metal, Parent = board.grate })
				end
				for b = -1, 1 do
					part({ Size = Vector3.new(TILE, 0.25, 0.25), CFrame = CFrame.new(pos + Vector3.new(0, -0.1, b * TILE * 0.3)), Color = Color3.fromRGB(93, 102, 122), Material = Enum.Material.Metal, Parent = board.grate })
				end
				board.grate.Parent = boardFolder
				local glow = part({ Size = Vector3.new(TILE * 0.7, 0.1, TILE * 0.7), CFrame = CFrame.new(pos - Vector3.new(0, 1.9, 0)), Color = C.gold, Material = Enum.Material.Neon, Transparency = 1, Parent = boardFolder })
				local light = Instance.new("PointLight")
				light.Color = C.gold
				light.Range = 12
				light.Brightness = 0
				light.Parent = glow
				board.stairs = glow
				board.stairsLight = light
			else
				local tile = part({
					Size = Vector3.new(TILE, 1, TILE),
					CFrame = CFrame.new(pos - Vector3.new(0, 0.5, 0)),
					Color = if (x + y) % 2 == 0 then C.floorA else C.floorB,
					Material = Enum.Material.Slate,
					CanQuery = true,
					CanCollide = true,
					Parent = boardFolder,
				})
				if boss then
					tile.Color = shade(tile.Color, -0.1):Lerp(Color3.fromRGB(80, 20, 30), 0.15)
				end
				board.tiles[i] = tile
				if spikes[i] then
					for sx = -1, 1 do
						for sz = -1, 1 do
							if (sx + sz) % 2 == 0 then
								part({
									Class = "WedgePart",
									Size = Vector3.new(0.4, 0.9, 0.4),
									CFrame = CFrame.new(pos + Vector3.new(sx * 1.1, 0.45, sz * 1.1)),
									Color = Color3.fromRGB(201, 209, 224),
									Material = Enum.Material.Metal,
									Parent = boardFolder,
								})
							end
						end
					end
				end
			end
		end
	end
	-- Low rim walls around the room, and four torches.
	local half = W * TILE / 2
	for _, side in { { 0, -1 }, { 0, 1 }, { -1, 0 }, { 1, 0 } } do
		local sx, sz = side[1], side[2]
		local size = if sx == 0 then Vector3.new(W * TILE + 2, 2, 1) else Vector3.new(1, 2, H * TILE + 2)
		part({ Size = size, CFrame = CFrame.new(ORIGIN + Vector3.new(sx * (half + 0.5), 0, sz * (half + 0.5))), Color = Color3.fromRGB(30, 24, 40), Material = Enum.Material.Slate, Parent = boardFolder })
	end
	for _, c in { { -1, -1 }, { 1, -1 }, { -1, 1 }, { 1, 1 } } do
		torch(ORIGIN + Vector3.new(c[1] * (half + 1), 1, c[2] * (half + 1)))
	end
	board.feature = if state.feature then buildFeature(state.feature) else nil
	board.potion = nil
	if state.potion then
		local model, root = buildVoxel(Sprites.POTION, {})
		root.CFrame = CFrame.new(tilePos(state.potion.x, state.potion.y)) * CFrame.Angles(-LEAN, 0, 0)
		model.Parent = boardFolder
		board.potion = model
	end
end

local function refreshBoard(state)
	if board.stairsLight then
		board.stairsLight.Brightness = if state.stairsOpen then 3 else 0
		board.stairs.Transparency = if state.stairsOpen then 0.2 else 1
		if board.grate then
			board.grate.Parent = if state.stairsOpen then nil else boardFolder
		end
	end
	if board.potion and not state.potion then
		board.potion:Destroy()
		board.potion = nil
	end
	if board.feature and state.feature then
		setFeatureUsed(board.feature, state.feature.used)
	end
	clearFolder(markFolder)
	for _, w in state.warnings do
		local color = if w.kind == "plague" then Color3.fromRGB(181, 224, 122) else Color3.fromRGB(211, 176, 255)
		local m = part({ Size = Vector3.new(TILE * 0.9, 0.1, TILE * 0.9), CFrame = CFrame.new(tilePos(w.x, w.y) + Vector3.new(0, 0.06, 0)), Color = color, Material = Enum.Material.Neon, Transparency = 0.45, Parent = markFolder })
		TweenService:Create(m, TweenInfo.new(0.45, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true), { Transparency = 0.8 }):Play()
	end
	for _, e in state.enemies do
		for _, p in e.path do
			part({ Size = Vector3.new(TILE * 0.3, 0.08, TILE * 0.3), CFrame = CFrame.new(tilePos(p.x, p.y) + Vector3.new(0, 0.05, 0)) * CFrame.Angles(0, math.rad(45), 0), Color = C.red, Material = Enum.Material.Neon, Transparency = 0.35, Parent = markFolder })
		end
	end
end

-- ---------- units ----------

local units = {} -- [id] = unit; the hero is "hero"

local function makeLabel(parent: Instance, size: UDim2, text: string, color: Color3, font, textSize: number): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Size = size
	l.Font = font
	l.Text = text
	l.TextColor3 = color
	l.TextSize = textSize
	l.TextStrokeTransparency = 0.3
	l.Parent = parent
	return l
end

local function unitGui(root: BasePart, height: number)
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(64, 26)
	gui.StudsOffsetWorldSpace = Vector3.new(0, height, 0)
	gui.LightInfluence = 0
	gui.AlwaysOnTop = true
	gui.Parent = root
	local back = Instance.new("Frame")
	back.Size = UDim2.new(1, 0, 0, 6)
	back.Position = UDim2.new(0, 0, 1, -6)
	back.BackgroundColor3 = Color3.fromRGB(42, 24, 32)
	back.BorderSizePixel = 0
	back.Parent = gui
	local fill = Instance.new("Frame")
	fill.Name = "Fill"
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = C.red
	fill.BorderSizePixel = 0
	fill.Parent = back
	local tag = makeLabel(gui, UDim2.new(1, 0, 1, -7), "", C.text, BOLD, 12)
	tag.Name = "Tag"
	return gui, fill, tag
end

local function heroCloak(hero: string)
	return Sprites.CLOAKS[hero] or Sprites.CLOAKS.default
end

-- Store cosmetics the player owns: { cloak = key or "", aura = bool, crown = bool }.
local cosmetics = { cloak = "", aura = false, crown = false }

--- Founder's crown: a little gold voxel crown on the hero's head.
local function addCrown(model: Model, root: BasePart)
	local gold = Color3.fromRGB(242, 193, 78)
	local y = 12.5 * PIX
	local pieces = {
		{ Vector3.new(PIX * 6, PIX, PIX * 2.2), Vector3.new(0, y, 0) },
		{ Vector3.new(PIX, PIX, PIX * 2.2), Vector3.new(-PIX * 2.5, y + PIX, 0) },
		{ Vector3.new(PIX, PIX * 1.6, PIX * 2.2), Vector3.new(0, y + PIX * 1.3, 0) },
		{ Vector3.new(PIX, PIX, PIX * 2.2), Vector3.new(PIX * 2.5, y + PIX, 0) },
	}
	for _, piece in pieces do
		local p = part({ Size = piece[1], Color = gold, Material = Enum.Material.Neon, Anchored = false })
		p.CFrame = root.CFrame * CFrame.new(piece[2] + Vector3.new(-0.5 * PIX, 0, 0))
		local weld = Instance.new("WeldConstraint")
		weld.Part0 = root
		weld.Part1 = p
		weld.Parent = p
		p.Parent = model
	end
	local gem = part({ Size = Vector3.new(PIX * 0.8, PIX * 0.8, PIX * 2.4), Color = Color3.fromRGB(210, 58, 70), Material = Enum.Material.Neon, Anchored = false })
	gem.CFrame = root.CFrame * CFrame.new(-0.5 * PIX, y, 0)
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = root
	weld.Part1 = gem
	weld.Parent = gem
	gem.Parent = model
end

--- Soulfire aura: blue flames and embers rising off the hero.
local function addAura(root: BasePart)
	local att = Instance.new("Attachment")
	att.Position = Vector3.new(0, 6 * PIX, 0)
	att.Parent = root
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(Color3.fromRGB(127, 200, 255), Color3.fromRGB(60, 90, 255))
	pe.LightEmission = 1
	pe.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 0) })
	pe.Transparency = NumberSequence.new(0.2, 1)
	pe.Lifetime = NumberRange.new(0.6, 1.1)
	pe.Rate = 26
	pe.Speed = NumberRange.new(1, 2.5)
	pe.SpreadAngle = Vector2.new(25, 25)
	pe.Acceleration = Vector3.new(0, 3, 0)
	pe.Shape = Enum.ParticleEmitterShape.Box
	pe.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	pe.Parent = att
	local glow = Instance.new("PointLight")
	glow.Color = Color3.fromRGB(110, 160, 255)
	glow.Range = 8
	glow.Brightness = 1.5
	glow.Parent = att
end

local function newUnit(id, kind: string, ally: boolean, heroId: string?)
	local rows, colors, lit = nil, {}, true
	if kind == "hero" then
		rows = Sprites.PLAYER
		lit = false
		local cloak = Store.cloakByKey(cosmetics.cloak) or heroCloak(heroId or "knight")
		colors = { p = cloak.p, P = cloak.P }
	else
		rows = Sprites.ENEMIES[kind].idle[1]
		if ally then
			-- Thralls glow a sickly green.
			colors = { e = C.green }
		end
	end
	local model, root = buildVoxel(rows, colors, lit)
	model.Name = tostring(id)
	local big = kind == "boss" or kind == "abbot" or kind == "lich"
	local scale = if big then 1.45 else 1
	if big then
		model:ScaleTo(scale)
	end
	local highlight = Instance.new("Highlight")
	highlight.FillColor = Color3.new(1, 1, 1)
	highlight.FillTransparency = 1
	highlight.OutlineTransparency = 1
	highlight.DepthMode = Enum.HighlightDepthMode.Occluded
	highlight.Parent = model
	model.Parent = unitFolder
	local u = { id = id, kind = kind, model = model, root = root, highlight = highlight, facing = 1, x = nil, y = nil, scale = scale }
	if kind ~= "hero" then
		u.gui, u.fill, u.tag = unitGui(root, 12 * PIX * scale * math.cos(LEAN) + 0.6)
	else
		local light = Instance.new("PointLight")
		light.Color = Color3.fromRGB(255, 200, 150)
		light.Range = 14
		light.Brightness = 1.4
		light.Shadows = true
		light.Parent = root
		if cosmetics.crown then
			addCrown(model, root)
		end
		if cosmetics.aura then
			addAura(root)
		end
	end
	units[id] = u
	return u
end

local function placeUnit(u, x: number, y: number, facing: number, instant: boolean)
	local target = CFrame.new(tilePos(x, y)) * CFrame.Angles(-LEAN, 0, 0) * CFrame.Angles(0, if facing < 0 then math.pi else 0, 0)
	if instant or not u.x then
		u.root.CFrame = target
	else
		TweenService:Create(u.root, TweenInfo.new(0.13, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { CFrame = target }):Play()
	end
	u.x, u.y, u.facing = x, y, facing
end

local function flash(u, color: Color3?)
	u.highlight.FillColor = color or Color3.new(1, 1, 1)
	u.highlight.FillTransparency = 0.1
	TweenService:Create(u.highlight, TweenInfo.new(0.18), { FillTransparency = 1 }):Play()
end

local function lunge(u, dir)
	if not u.x then
		return
	end
	local base = CFrame.new(tilePos(u.x, u.y)) * CFrame.Angles(-LEAN, 0, 0) * CFrame.Angles(0, if u.facing < 0 then math.pi else 0, 0)
	local out = base + Vector3.new(dir.x, 0, dir.y) * TILE * 0.3
	local t = TweenService:Create(u.root, TweenInfo.new(0.07, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { CFrame = out })
	t.Completed:Connect(function()
		TweenService:Create(u.root, TweenInfo.new(0.1, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { CFrame = base }):Play()
	end)
	t:Play()
end

--- Smash a model into its voxels.
local function shatter(u)
	local model = u.model
	if u.gui then
		u.gui:Destroy()
	end
	u.root.Anchored = true
	for _, p in model:GetDescendants() do
		if p:IsA("BasePart") and p ~= u.root then
			for _, w in p:GetChildren() do
				if w:IsA("WeldConstraint") then
					w:Destroy()
				end
			end
			p.Anchored = false
			p.CanCollide = true
			p.AssemblyLinearVelocity = Vector3.new((math.random() - 0.5) * 18, 8 + math.random() * 10, (math.random() - 0.5) * 18)
			p.AssemblyAngularVelocity = Vector3.new(math.random() * 10, math.random() * 10, math.random() * 10)
			TweenService:Create(p, TweenInfo.new(0.8, Enum.EasingStyle.Linear, Enum.EasingDirection.In, 0, false, 0.2), { Transparency = 1 }):Play()
		end
	end
	Debris:AddItem(model, 1.2)
	units[u.id] = nil
end

local function updateUnitGui(u, e)
	local frac = math.clamp(e.hp / math.max(1, e.maxHp), 0, 1)
	u.fill.Size = UDim2.fromScale(frac, 1)
	u.fill.BackgroundColor3 = if e.ally then C.green else C.red
	local bits = {}
	if e.elite ~= "" then
		table.insert(bits, Content.ELITES[e.elite].name)
	end
	if e.shield > 0 then
		table.insert(bits, "🛡")
	end
	if e.frozen > 0 then
		table.insert(bits, "❄")
	end
	if e.burn > 0 then
		table.insert(bits, "🔥")
	end
	u.tag.Text = table.concat(bits, " ")
	u.tag.TextColor3 = if e.elite ~= "" then Content.ELITES[e.elite].color else C.text
	u.highlight.OutlineColor = if e.elite ~= "" then Content.ELITES[e.elite].color else C.text
	u.highlight.OutlineTransparency = if e.elite ~= "" then 0.2 elseif e.frozen > 0 then 0.4 else 1
	if e.frozen > 0 and e.elite == "" then
		u.highlight.OutlineColor = C.ice
	end
end

-- Rival racers on your floor, drawn as see-through heroes with their names.
local ghosts = {} -- [userId] = { model, root, x, y }
local ghostFolder = Instance.new("Folder")
ghostFolder.Name = "Ghosts"
ghostFolder.Parent = world

local function clearGhosts()
	for id, g in ghosts do
		g.model:Destroy()
		ghosts[id] = nil
	end
end

local function updateGhosts(race, myFloor: number?)
	local seen = {}
	if race and race.phase == "running" and myFloor then
		for _, r in race.standings do
			if not r.you and r.alive and not r.left and r.floor == myFloor and r.userId ~= player.UserId then
				seen[r.userId] = true
				local g = ghosts[r.userId]
				if not g then
					local cloak = Sprites.CLOAKS[race.hero] or Sprites.CLOAKS.default
					local model, root = buildVoxel(Sprites.PLAYER, { p = cloak.p, P = cloak.P }, false)
					for _, p in model:GetDescendants() do
						if p:IsA("BasePart") and p ~= root then
							p.Transparency = 0.55
							p.CastShadow = false
						end
					end
					local tag = Instance.new("BillboardGui")
					tag.Size = UDim2.fromOffset(120, 20)
					tag.StudsOffsetWorldSpace = Vector3.new(0, 12 * PIX * math.cos(LEAN) + 0.7, 0)
					tag.AlwaysOnTop = true
					tag.LightInfluence = 0
					tag.Parent = root
					local label = Instance.new("TextLabel")
					label.BackgroundTransparency = 1
					label.Size = UDim2.fromScale(1, 1)
					label.Font = Enum.Font.GothamBold
					label.TextSize = 13
					label.TextColor3 = Color3.fromRGB(159, 232, 255)
					label.TextStrokeTransparency = 0.3
					label.Text = r.name
					label.Parent = tag
					model.Parent = ghostFolder
					g = { model = model, root = root }
					ghosts[r.userId] = g
					root.CFrame = CFrame.new(tilePos(r.x, r.y) + Vector3.new(0.6, 0, 0.6)) * CFrame.Angles(-LEAN, 0, 0)
				end
				-- Nudged off-centre so a rival on your tile doesn't hide you.
				local target = CFrame.new(tilePos(r.x, r.y) + Vector3.new(0.6, 0, 0.6)) * CFrame.Angles(-LEAN, 0, 0)
				TweenService:Create(g.root, TweenInfo.new(0.15), { CFrame = target }):Play()
			end
		end
	end
	for id, g in ghosts do
		if not seen[id] then
			g.model:Destroy()
			ghosts[id] = nil
		end
	end
end

local function clearUnits()
	for id, u in units do
		u.model:Destroy()
		units[id] = nil
	end
end

-- ---------- GUI helpers ----------

local gui = Instance.new("ScreenGui")
gui.Name = "OneMoreCrypt"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
gui.Parent = player:WaitForChild("PlayerGui")

local function new(class: string, props, children: { Instance }?)
	local inst = Instance.new(class)
	for k, v in props do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	if children then
		for _, c in children do
			c.Parent = inst
		end
	end
	if props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

local function corner(r: number?)
	return new("UICorner", { CornerRadius = UDim.new(0, r or 8) })
end

local function stroke(color: Color3?, t: number?)
	return new("UIStroke", { Color = color or C.line, Thickness = t or 1.5, ApplyStrokeMode = Enum.ApplyStrokeMode.Border })
end

local function pad(n: number)
	return new("UIPadding", { PaddingLeft = UDim.new(0, n), PaddingRight = UDim.new(0, n), PaddingTop = UDim.new(0, n), PaddingBottom = UDim.new(0, n) })
end

local function list(spacing: number, horizontal: boolean?, align)
	return new("UIListLayout", {
		Padding = UDim.new(0, spacing),
		FillDirection = if horizontal then Enum.FillDirection.Horizontal else Enum.FillDirection.Vertical,
		HorizontalAlignment = align or Enum.HorizontalAlignment.Center,
		VerticalAlignment = if horizontal then Enum.VerticalAlignment.Center else Enum.VerticalAlignment.Top,
		SortOrder = Enum.SortOrder.LayoutOrder,
	})
end

local function text(props)
	local defaults = {
		BackgroundTransparency = 1,
		Font = BODY,
		TextColor3 = C.text,
		TextSize = 16,
		TextWrapped = true,
		Size = UDim2.new(1, 0, 0, 20),
		AutomaticSize = Enum.AutomaticSize.Y,
	}
	for k, v in props do
		defaults[k] = v
	end
	return new("TextLabel", defaults)
end

local function button(label: string, onClick: () -> (), props)
	local defaults = {
		Size = UDim2.new(1, 0, 0, 44),
		BackgroundColor3 = C.panel2,
		AutoButtonColor = true,
		Font = BOLD,
		Text = label,
		TextColor3 = C.text,
		TextSize = 17,
		TextWrapped = true,
	}
	for k, v in props or {} do
		defaults[k] = v
	end
	local b = new("TextButton", defaults, { corner(8), stroke() })
	b.Activated:Connect(function()
		sound(SFX.click, 0.3)
		onClick()
	end)
	return b
end

local function overlay(name: string, maxWidth: number?)
	local shade = new("Frame", {
		Name = name,
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = C.bg,
		BackgroundTransparency = 0.25,
		Visible = false,
		ZIndex = 5,
		Parent = gui,
	})
	local scroll = new("ScrollingFrame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 4,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		Parent = shade,
	}, { list(0), new("UIPadding", { PaddingTop = UDim.new(0, 56), PaddingBottom = UDim.new(0, 40), PaddingLeft = UDim.new(0, 16), PaddingRight = UDim.new(0, 16) }) })
	local card = new("Frame", {
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = C.panel,
		Parent = scroll,
	}, { corner(12), stroke(C.line, 2), pad(18), list(10), new("UISizeConstraint", { MaxSize = Vector2.new(maxWidth or 520, math.huge) }) })
	return shade, card
end

local function clear(frame: Instance)
	for _, c in frame:GetChildren() do
		if c:IsA("GuiObject") then
			c:Destroy()
		end
	end
end

local screens: { [string]: any } = {}
local menus: { [string]: any } = {}
local function show(name: string?)
	for n, s in screens do
		s.Visible = n == name
	end
end

-- ---------- state ----------

local state = nil
local profile = nil
local busy = false
local queue = {}
local inRun = false

local hud -- forward
local renderOverlays -- forward
local showMenu -- forward

local function call(req)
	local ok, res = pcall(function()
		return remote:InvokeServer(req)
	end)
	if not ok then
		return { error = "Lost touch with the crypt. Try again." }
	end
	return res
end

-- ---------- toast & banner ----------

local toast = new("TextLabel", {
	AnchorPoint = Vector2.new(0.5, 0),
	Position = UDim2.new(0.5, 0, 0, 120),
	Size = UDim2.fromOffset(0, 0),
	AutomaticSize = Enum.AutomaticSize.XY,
	BackgroundColor3 = C.panel,
	BackgroundTransparency = 0.1,
	Font = BOLD,
	TextSize = 16,
	TextColor3 = C.text,
	Visible = false,
	ZIndex = 20,
	Parent = gui,
}, { corner(8), pad(10), stroke(C.gold) })
local toastToken = 0
local function showToast(msg: string, color: Color3?)
	toastToken += 1
	local my = toastToken
	toast.Text = msg
	toast.TextColor3 = color or C.text
	toast.Visible = true
	task.delay(2.6, function()
		if toastToken == my then
			toast.Visible = false
		end
	end)
end

local banner = new("TextLabel", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(0.5, 0.32),
	Size = UDim2.new(1, 0, 0, 60),
	BackgroundTransparency = 1,
	Font = HEADING,
	TextSize = 40,
	TextColor3 = C.gold,
	TextStrokeTransparency = 0,
	TextTransparency = 1,
	TextStrokeColor3 = Color3.new(0, 0, 0),
	ZIndex = 15,
	Parent = gui,
})
local function showBanner(msg: string, color: Color3?)
	banner.Text = msg
	banner.TextColor3 = color or C.gold
	banner.TextTransparency = 0
	banner.TextStrokeTransparency = 0
	TweenService:Create(banner, TweenInfo.new(0.6, Enum.EasingStyle.Linear, Enum.EasingDirection.In, 0, false, 1), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
end

-- ---------- events → effects ----------

local HIT_COLORS = {
	melee = Color3.fromRGB(255, 255, 255), burn = Color3.fromRGB(255, 138, 42), thorns = Color3.fromRGB(127, 154, 82),
	bolt = C.ice, burst = C.red, pierce = Color3.fromRGB(255, 255, 255), whirl = Color3.fromRGB(201, 209, 224),
	hellfire = Color3.fromRGB(255, 90, 42), spike = Color3.fromRGB(201, 209, 224), mask = Color3.fromRGB(127, 154, 82),
	ally = C.green, claw = Color3.fromRGB(255, 77, 90),
}

local BOSS_NAMES = { boss = "THE BONE WARDEN", abbot = "THE PLAGUE ABBOT", lich = "THE LICH KING" }

local function playEvents(events, s)
	local hero = units.hero
	local killed = {}
	for _, ev in events do
		local t = ev.t
		if t == "pattack" then
			if hero then
				lunge(hero, ev.dir)
			end
			sound(SFX.swing, 0.35, 0.9 + math.random() * 0.2)
		elseif t == "eattack" then
			local u = units[ev.id]
			if u then
				lunge(u, ev.dir)
			end
		elseif t == "hit" then
			floater(ev.x, ev.y, tostring(ev.amount) .. (if ev.crit then "!" else ""), if ev.crit then C.gold else HIT_COLORS[ev.kind] or C.text, if ev.crit then 1.4 else 1)
			local u = units[ev.id]
			if u then
				flash(u, if ev.kind == "burn" then Color3.fromRGB(255, 138, 42) else nil)
			end
			if ev.crit then
				shake(0.6, 0.15)
			end
		elseif t == "eblock" then
			floater(ev.x, ev.y, "BLOCK", C.ice, 0.8)
			burst(tilePos(ev.x, ev.y) + Vector3.new(0, 1.5, 0), C.ice, 10)
		elseif t == "kill" then
			killed[ev.id] = true
			local color = if ev.ally then C.green elseif ev.kind == "wraith" then C.ice else Color3.fromRGB(232, 220, 196)
			burst(tilePos(ev.x, ev.y) + Vector3.new(0, 1.5, 0), color, 14)
			if BOSS_NAMES[ev.kind] then
				showBanner(BOSS_NAMES[ev.kind] .. " FALLS", C.gold)
				shake(1.2, 0.4)
			end
		elseif t == "hurt" then
			floater(s.x, s.y, "-" .. ev.amount, Color3.fromRGB(255, 77, 90), 1.1)
			if hero then
				flash(hero, C.red)
			end
			shake(0.5 + math.min(1, ev.amount / 5), 0.18)
		elseif t == "heal" then
			floater(s.x, s.y, "+" .. ev.amount, C.green, 1)
		elseif t == "maxhp" then
			floater(s.x, s.y, `+{ev.amount} MAX`, C.green, 1.1)
		elseif t == "dodge" then
			floater(s.x, s.y, "DODGE", Color3.fromRGB(201, 209, 224), 0.9)
		elseif t == "block" then
			floater(s.x, s.y, "BLOCK", C.ice, 0.9)
			burst(tilePos(s.x, s.y) + Vector3.new(0, 1.5, 0), C.ice, 10)
		elseif t == "revive" then
			floater(s.x, s.y, "DEATH DENIED", C.gold, 1.4)
			burst(tilePos(s.x, s.y) + Vector3.new(0, 1.5, 0), C.gold, 30, 1.5)
		elseif t == "bolt" then
			beam(tilePos(ev.from.x, ev.from.y) + Vector3.new(0, 1.5, 0), tilePos(ev.to.x, ev.to.y) + Vector3.new(0, 1.5, 0), C.ice, 0.25, 0.3)
		elseif t == "shot" then
			beam(tilePos(ev.from.x, ev.from.y) + Vector3.new(0, 1.4, 0), tilePos(ev.to.x, ev.to.y) + Vector3.new(0, 1.4, 0), Color3.fromRGB(232, 220, 196), 0.2, 0.15)
		elseif t == "burst" then
			burst(tilePos(ev.x, ev.y) + Vector3.new(0, 1, 0), C.red, 18, 1.4)
		elseif t == "summon" or t == "raise" then
			burst(tilePos(ev.x, ev.y) + Vector3.new(0, 0.5, 0), if t == "raise" then C.green else Color3.fromRGB(127, 154, 82), 16)
			if t == "raise" then
				floater(ev.x, ev.y, "RISE", C.green, 1)
			end
		elseif t == "teleport" then
			burst(tilePos(ev.from.x, ev.from.y) + Vector3.new(0, 1.5, 0), Color3.fromRGB(155, 107, 214), 18)
			burst(tilePos(ev.to.x, ev.to.y) + Vector3.new(0, 1.5, 0), Color3.fromRGB(155, 107, 214), 18)
		elseif t == "spike" then
			burst(tilePos(ev.x, ev.y) + Vector3.new(0, 0.5, 0), Color3.fromRGB(201, 209, 224), 8)
		elseif t == "shadow" then
			floater(s.x, s.y, "UNSEEN", C.dim, 0.8)
		elseif t == "stairs" then
			burst(tilePos(s.stairs.x, s.stairs.y), C.gold, 24)
			floater(s.stairs.x, s.stairs.y, "DESCEND", C.gold, 1.2)
		elseif t == "potion" then
			burst(tilePos(s.x, s.y) + Vector3.new(0, 1, 0), Color3.fromRGB(255, 77, 90), 14)
		elseif t == "timestop" then
			showBanner("TIME STOPS", C.ice)
		elseif t == "toll" then
			showBanner("THE BELL TOLLS", C.gold)
			shake(0.8, 0.3)
		elseif t == "relic" then
			local def = Relics.BY_ID[ev.id]
			showToast(`{def.emoji}  {def.name}`, Relics.RARITY_COLOR[def.rarity])
			sound(SFX.pick, 0.4)
		elseif t == "fuse" then
			local def = Relics.BY_ID[ev.id]
			showBanner(`{def.emoji} {string.upper(def.name)}`, Relics.RARITY_COLOR[def.rarity])
			burst(tilePos(s.x, s.y) + Vector3.new(0, 1.5, 0), Color3.fromRGB(127, 180, 255), 40, 1.6)
			sound(SFX.pick, 0.5, 0.7)
		elseif t == "floor" then
			if s.boss then
				local tier = s.floor // 5
				local kind = ({ "boss", "abbot", "lich" })[(tier - 1) % 3 + 1]
				showBanner(BOSS_NAMES[kind], C.red)
			else
				showBanner(`FLOOR {ev.floor}`, if ev.floor > 30 then C.red else C.gold)
			end
		elseif t == "death" then
			if hero then
				burst(tilePos(s.x, s.y) + Vector3.new(0, 1.5, 0), C.red, 40, 1.8)
			end
			shake(1.5, 0.5)
			sound(SFX.death, 0.6)
		end
	end
	return killed
end

local function applyState(s, events)
	local floorChanged = s.floor ~= board.floor
	if floorChanged then
		clearUnits()
		buildBoard(s)
	end
	refreshBoard(s)

	local killed = playEvents(events or {}, s)

	-- The hero.
	local hero = units.hero
	if not hero then
		hero = newUnit("hero", "hero", false, s.hero)
	end
	local heroFacing = hero.facing
	if hero.x and s.x ~= hero.x then
		heroFacing = if s.x > hero.x then 1 else -1
	end
	if s.phase == "dead" then
		if hero.model.Parent then
			shatter(hero)
		end
	else
		placeUnit(hero, s.x, s.y, heroFacing, floorChanged)
		hero.highlight.OutlineColor = C.gold
		hero.highlight.OutlineTransparency = if s.shadowReady then 0.3 elseif s.shield > 0 then 0.5 else 1
		if s.shield > 0 then
			hero.highlight.OutlineColor = C.ice
		end
	end

	-- Foes and thralls.
	local present = {}
	for _, e in s.enemies do
		present[e.id] = true
		local u = units[e.id]
		if not u then
			u = newUnit(e.id, e.kind, e.ally)
			placeUnit(u, e.x, e.y, if s.x < e.x then -1 else 1, true)
			if not floorChanged then
				burst(tilePos(e.x, e.y) + Vector3.new(0, 1, 0), Color3.fromRGB(127, 154, 82), 10)
			end
		end
		-- Foes face the hero; thralls face where they're going.
		local facing = if e.ally then (if u.x and e.x ~= u.x then (if e.x > u.x then 1 else -1) else u.facing) else (if s.x < e.x then -1 elseif s.x > e.x then 1 else u.facing)
		placeUnit(u, e.x, e.y, facing, false)
		updateUnitGui(u, e)
	end
	for id, u in units do
		if id ~= "hero" and not present[id] then
			if killed[id] then
				shatter(u)
			else
				u.model:Destroy()
				units[id] = nil
			end
		end
	end
	state = s
	hud.update(s)
	renderOverlays(s)
end

-- ---------- input ----------

local function pump()
	if busy then
		return
	end
	busy = true
	while #queue > 0 and inRun do
		local ch = table.remove(queue, 1)
		local res = call({ op = "input", ch = ch })
		if res.error then
			queue = {}
			if res.error ~= "no run" then
				showToast(res.error, C.red)
			end
			break
		end
		applyState(res.state, res.events)
		if res.result then
			queue = {}
			renderOverlays(res.state, res.result)
		end
		if #queue > 0 then
			task.wait(0.05)
		end
	end
	busy = false
end

local function send(ch: string)
	if not inRun or not state then
		return
	end
	if #queue >= 2 then
		return
	end
	table.insert(queue, ch)
	task.spawn(pump)
end

local function moveToward(tx: number, ty: number)
	if not state or state.phase ~= "play" then
		return
	end
	local dx, dy = tx - state.x, ty - state.y
	if dx == 0 and dy == 0 then
		send("W")
	elseif math.abs(dx) >= math.abs(dy) then
		send(if dx > 0 then "R" else "L")
	else
		send(if dy > 0 then "D" else "U")
	end
end

local KEYS_MOVE = {
	[Enum.KeyCode.W] = "U", [Enum.KeyCode.Up] = "U", [Enum.KeyCode.K] = "U",
	[Enum.KeyCode.S] = "D", [Enum.KeyCode.Down] = "D", [Enum.KeyCode.J] = "D",
	[Enum.KeyCode.A] = "L", [Enum.KeyCode.Left] = "L", [Enum.KeyCode.H] = "L",
	[Enum.KeyCode.D] = "R", [Enum.KeyCode.Right] = "R", [Enum.KeyCode.L] = "R",
	[Enum.KeyCode.Space] = "W", [Enum.KeyCode.Period] = "W",
}
local NUMBER_KEYS = { Enum.KeyCode.One, Enum.KeyCode.Two, Enum.KeyCode.Three, Enum.KeyCode.Four, Enum.KeyCode.Five, Enum.KeyCode.Six, Enum.KeyCode.Seven, Enum.KeyCode.Eight, Enum.KeyCode.Nine }
local FORGE_KEYS = "bcdefghijklm"

local touchStart = nil

local function onKey(key: Enum.KeyCode)
	do
		if state.phase == "play" then
			local ch = KEYS_MOVE[key]
			if ch then
				send(ch)
			end
		elseif state.phase == "choose" then
			local n = table.find(NUMBER_KEYS, key)
			if n and state.offer and n <= #state.offer.relics then
				send(tostring(n - 1))
			elseif key == Enum.KeyCode.R then
				send("r")
			end
		elseif state.phase == "event" then
			local n = table.find(NUMBER_KEYS, key)
			if state.feature and state.feature.kind == "forge" and n and n <= #state.forge then
				send(string.sub(FORGE_KEYS, n, n))
			elseif key == Enum.KeyCode.Y or key == Enum.KeyCode.Return then
				if state.canAccept and state.feature.kind ~= "forge" then
					send("a")
				end
			elseif key == Enum.KeyCode.N or key == Enum.KeyCode.X then
				send("x")
			end
		end
	end
end

local GAME_KEYS = { Enum.KeyCode.R, Enum.KeyCode.Y, Enum.KeyCode.N, Enum.KeyCode.X, Enum.KeyCode.Return }
for key in KEYS_MOVE do
	table.insert(GAME_KEYS, key)
end
for _, key in NUMBER_KEYS do
	table.insert(GAME_KEYS, key)
end
ContextActionService:BindActionAtPriority("CryptKeys", function(_, inputState, input)
	if not inRun or not state then
		return Enum.ContextActionResult.Pass
	end
	if inputState == Enum.UserInputState.Begin then
		onKey(input.KeyCode)
	end
	return Enum.ContextActionResult.Sink
end, false, Enum.ContextActionPriority.High.Value + 100, table.unpack(GAME_KEYS))

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or not inRun or not state then
		return
	end
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		touchStart = input.Position
	end
end)

UserInputService.InputEnded:Connect(function(input, processed)
	if not touchStart or not inRun or not state or state.phase ~= "play" then
		touchStart = nil
		return
	end
	if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then
		return
	end
	local delta = input.Position - touchStart
	local startPos = touchStart
	touchStart = nil
	if processed then
		return
	end
	if delta.Magnitude > 40 then
		-- Swipe.
		if math.abs(delta.X) > math.abs(delta.Y) then
			send(if delta.X > 0 then "R" else "L")
		else
			send(if delta.Y > 0 then "D" else "U")
		end
		return
	end
	-- Tap a tile to step toward it.
	local ray = camera:ViewportPointToRay(startPos.X, startPos.Y)
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { boardFolder }
	local hit = workspace:Raycast(ray.Origin, ray.Direction * 500, params)
	if hit then
		local local3 = hit.Position - ORIGIN
		local tx = math.floor(local3.X / TILE + 3.5)
		local ty = math.floor(local3.Z / TILE + 3.5)
		if tx >= 0 and tx < W and ty >= 0 and ty < H then
			moveToward(tx, ty)
		end
	end
end)

-- ---------- HUD ----------

hud = {}
do
	local top = new("Frame", {
		Name = "HUD",
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundTransparency = 1,
		Visible = false,
		Parent = gui,
	}, { new("UIPadding", { PaddingTop = UDim.new(0, 48), PaddingLeft = UDim.new(0, 12), PaddingRight = UDim.new(0, 12) }), list(6) })
	screens.hud = top
	local row = new("Frame", { Size = UDim2.new(1, 0, 0, 40), BackgroundTransparency = 1, LayoutOrder = 1, Parent = top }, {
		new("UISizeConstraint", { MaxSize = Vector2.new(640, 40) }),
	})
	local floorLabel = text({ Size = UDim2.new(0.32, 0, 0, 24), AutomaticSize = Enum.AutomaticSize.None, Font = HEADING, TextSize = 20, TextXAlignment = Enum.TextXAlignment.Left, Text = "", Parent = row })
	local modeLabel = text({ Position = UDim2.fromOffset(0, 24), Size = UDim2.new(0.32, 0, 0, 14), AutomaticSize = Enum.AutomaticSize.None, TextSize = 12, TextColor3 = C.dim, TextXAlignment = Enum.TextXAlignment.Left, Text = "", Parent = row })
	local hpBack = new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0.34, 0, 0, 22), BackgroundColor3 = Color3.fromRGB(42, 24, 32), Parent = row }, { corner(6), stroke(C.line) })
	local hpFill = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = C.red, Parent = hpBack }, { corner(6) })
	local hpText = text({ Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, Font = BOLD, TextSize = 14, Text = "", ZIndex = 2, Parent = hpBack })
	local stats = text({ AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -48, 0, 0), Size = UDim2.new(0.32, -50, 1, 0), AutomaticSize = Enum.AutomaticSize.None, Font = BOLD, TextSize = 15, TextXAlignment = Enum.TextXAlignment.Right, Text = "", Parent = row })
	button("☰", function()
		if busy then
			return
		end
		local res = call({ op = "leave" })
		inRun = false
		queue = {}
		if res.profile then
			profile = res.profile
		end
		showMenu()
	end, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.fromScale(1, 0), Size = UDim2.fromOffset(40, 40), TextSize = 20, Parent = row })
	local relicRow = new("ScrollingFrame", {
		Size = UDim2.new(1, 0, 0, 40),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.X,
		ScrollingDirection = Enum.ScrollingDirection.X,
		ScrollBarThickness = 0,
		LayoutOrder = 2,
		Parent = top,
	}, { list(4, true, Enum.HorizontalAlignment.Left), new("UISizeConstraint", { MaxSize = Vector2.new(640, 40) }) })
	local hint = text({
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -12),
		Size = UDim2.new(1, -24, 0, 18),
		TextColor3 = C.dim,
		TextSize = 14,
		Text = "WASD / arrows to move · bump foes to attack · Space to wait · tap a tile",
		Visible = false,
		Parent = gui,
	})
	screens.hint = hint

	-- On-screen d-pad for touch screens.
	local dpad = new("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.new(0.5, 0, 1, -16),
		Size = UDim2.fromOffset(168, 168),
		BackgroundTransparency = 1,
		Visible = false,
		Parent = gui,
	})
	screens.dpad = dpad
	local function padButton(label: string, ch: string, x: number, y: number)
		button(label, function()
			send(ch)
		end, { Position = UDim2.fromOffset(x, y), Size = UDim2.fromOffset(54, 54), TextSize = 22, BackgroundTransparency = 0.25, Parent = dpad })
	end
	padButton("▲", "U", 57, 0)
	padButton("▼", "D", 57, 114)
	padButton("◀", "L", 0, 57)
	padButton("▶", "R", 114, 57)
	padButton("⏳", "W", 57, 57)

	local tip = new("TextLabel", {
		AnchorPoint = Vector2.new(0.5, 0),
		Position = UDim2.new(0.5, 0, 0, 140),
		Size = UDim2.fromOffset(300, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		BackgroundColor3 = C.panel,
		Font = BODY,
		TextSize = 15,
		TextColor3 = C.text,
		TextWrapped = true,
		Visible = false,
		ZIndex = 12,
		Parent = gui,
	}, { corner(8), pad(10), stroke() })
	local tipToken = 0

	function hud.update(s)
		local f = s.floor
		floorLabel.Text = `FLOOR {f}`
		modeLabel.Text = if s.mode == "daily" then `Daily #{s.dailyNo}` else "Endless"
		floorLabel.TextColor3 = if s.boss then C.red elseif f > 30 then Color3.fromRGB(255, 120, 120) else C.gold
		hpFill.Size = UDim2.fromScale(math.clamp(s.hp / math.max(1, s.maxHp), 0, 1), 1)
		hpText.Text = `❤ {s.hp}/{s.maxHp}`
		local bits = { `⚔ {s.atk}`, `💀 {s.kills}` }
		if s.shield > 0 then
			table.insert(bits, 2, `🛡 {s.shield}`)
		end
		stats.Text = table.concat(bits, "   ")
		clear(relicRow)
		for i, r in s.relics do
			local b = new("TextButton", {
				Size = UDim2.fromOffset(if r.n > 1 then 54 else 38, 36),
				BackgroundColor3 = C.panel2,
				Text = r.emoji .. (if r.n > 1 then `×{r.n}` else ""),
				TextSize = 18,
				Font = BOLD,
				TextColor3 = C.text,
				LayoutOrder = i,
				Parent = relicRow,
			}, { corner(6), stroke(Relics.RARITY_COLOR[r.rarity], 1.5) })
			b.Activated:Connect(function()
				tipToken += 1
				local my = tipToken
				tip.Text = `{r.emoji} {r.name}\n{r.desc}`
				tip.Visible = true
				task.delay(3, function()
					if tipToken == my then
						tip.Visible = false
					end
				end)
			end)
		end
	end
end

-- ---------- run overlays ----------

local chooseScreen, chooseCard = overlay("Choose", 560)
local eventScreen, eventCard = overlay("Event", 480)
local deathScreen, deathCard = overlay("Death", 520)
screens.choose = chooseScreen
screens.event = eventScreen
screens.death = deathScreen

local function relicCard(r, onClick, order: number)
	local b = button("", onClick, { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, LayoutOrder = order, Parent = chooseCard })
	b:FindFirstChildOfClass("UIStroke").Color = Relics.RARITY_COLOR[r.rarity]
	new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Parent = b }, {
		pad(12),
		list(4, false, Enum.HorizontalAlignment.Left),
		text({ Text = `[{order}]  {r.emoji}  {r.name}` .. (if r.n > 1 then `  ×{r.n}` else ""), Font = BOLD, TextSize = 18, TextColor3 = Relics.RARITY_COLOR[r.rarity], TextXAlignment = Enum.TextXAlignment.Left }),
		text({ Text = r.desc, TextSize = 15, TextColor3 = C.text, TextXAlignment = Enum.TextXAlignment.Left }),
		text({ Text = string.upper(r.rarity), TextSize = 11, Font = BOLD, TextColor3 = C.dim, TextXAlignment = Enum.TextXAlignment.Left }),
	})
	return b
end

local function boardList(parent: Instance, rows, order: number)
	local box = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, LayoutOrder = order, Parent = parent }, { corner(8), pad(10), list(4) })
	if #rows == 0 then
		text({ Text = "No descents recorded yet.", TextColor3 = C.dim, Parent = box })
	end
	for _, row in rows do
		local floor = row.score // 10000
		local kills = row.score % 10000
		text({
			Text = `{row.rank}.  {row.name}   —   floor {floor} · {kills} kills`,
			TextXAlignment = Enum.TextXAlignment.Left,
			TextColor3 = if row.name == player.Name then C.gold else C.text,
			TextSize = 15,
			Parent = box,
		})
	end
	return box
end

local lastResult = nil

renderOverlays = function(s, result)
	if result then
		lastResult = result
	end
	if not inRun then
		return
	end
	local phase = s.phase
	if phase == "choose" then
		clear(chooseCard)
		text({ Text = `FLOOR {s.floor} CLEARED`, Font = HEADING, TextSize = 30, TextColor3 = C.gold, LayoutOrder = 0, Parent = chooseCard })
		text({ Text = "Take a relic, or rest.", TextColor3 = C.dim, LayoutOrder = 0, Parent = chooseCard })
		for i, r in s.offer.relics do
			relicCard(r, function()
				send(tostring(i - 1))
			end, i)
		end
		button(`[R]  Rest  (+{s.offer.restHeal} HP)`, function()
			send("r")
		end, { LayoutOrder = 10, Parent = chooseCard, TextColor3 = C.green })
		show("choose")
	elseif phase == "event" then
		clear(eventCard)
		local f = s.feature
		text({ Text = string.upper(f.name), Font = HEADING, TextSize = 28, TextColor3 = FEATURE_STYLE[f.kind].glow, Parent = eventCard })
		text({ Text = f.text, TextColor3 = C.text, Parent = eventCard })
		if f.kind == "forge" then
			if #s.forge == 0 then
				text({ Text = "You hold no pair of relics the forge can fuse.", TextColor3 = C.dim, Parent = eventCard })
			end
			for i, opt in s.forge do
				local b = button("", function()
					send(string.sub(FORGE_KEYS, i, i))
				end, { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, Parent = eventCard })
				b:FindFirstChildOfClass("UIStroke").Color = Relics.RARITY_COLOR[opt.rarity]
				new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Parent = b }, {
					pad(10),
					list(3, false, Enum.HorizontalAlignment.Left),
					text({ Text = `[{i}]  {opt.emoji}  {opt.name}`, Font = BOLD, TextSize = 17, TextColor3 = Relics.RARITY_COLOR[opt.rarity], TextXAlignment = Enum.TextXAlignment.Left }),
					text({ Text = opt.recipe, TextSize = 13, TextColor3 = C.dim, TextXAlignment = Enum.TextXAlignment.Left }),
					text({ Text = opt.desc, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Left }),
				})
			end
		else
			local accept = button(`[Y]  {f.accept}`, function()
				if s.canAccept then
					send("a")
				end
			end, { Parent = eventCard, TextColor3 = if s.canAccept then C.gold else C.dim })
			if not s.canAccept then
				accept.AutoButtonColor = false
			end
		end
		button(`[N]  {f.leave}`, function()
			send("x")
		end, { Parent = eventCard })
		show("event")
	elseif phase == "dead" and s.mode == "race" then
		menus.renderRaceWatch()
		show("racewatch")
	elseif phase == "dead" then
		local r = lastResult
		clear(deathCard)
		text({ Text = `YOU FELL ON FLOOR {s.floor}`, Font = HEADING, TextSize = 30, TextColor3 = C.red, Parent = deathCard })
		text({ Text = `Slain by {s.killedBy} · {s.kills} kills · {s.turns} turns · {s.heroName}`, TextColor3 = C.dim, Parent = deathCard })
		if s.emojis ~= "" then
			text({ Text = s.emojis, TextSize = 24, Parent = deathCard })
		end
		if r then
			local box = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = deathCard }, { corner(8), pad(10), list(3) })
			for _, l in r.lines do
				text({ Text = `{l.label}   +{l.souls}`, TextSize = 15, Parent = box })
			end
			text({ Text = `+{r.souls} Souls`, Font = HEADING, TextSize = 24, TextColor3 = C.gold, Parent = box })
			if r.newBest then
				text({ Text = "New best Endless depth!", Font = BOLD, TextColor3 = C.gold, Parent = deathCard })
			end
			if r.upsell then
				local pass = Store.passByKey("doubleSouls")
				button(`⚱️ Double every run's Souls with Grave Robber`, function()
					MarketplaceService:PromptGamePassPurchase(player, pass.id)
				end, { Parent = deathCard, TextSize = 15, TextColor3 = C.gold })
			end
			if r.board then
				text({ Text = if s.mode == "daily" then `DAILY #{s.dailyNo} LEADERBOARD` else "ENDLESS LEADERBOARD", Font = HEADING, TextSize = 18, TextColor3 = C.gold, Parent = deathCard })
				boardList(deathCard, r.board, 50)
				text({ Text = "Leaderboards refresh every minute.", TextSize = 12, TextColor3 = C.dim, LayoutOrder = 51, Parent = deathCard })
			end
		end
		if s.mode == "daily" then
			text({ Text = `Daily #{s.dailyNo + 1} opens at midnight Central Time. Endless is open now.`, TextColor3 = C.dim, LayoutOrder = 60, Parent = deathCard })
		end
		button("Descend again (Endless)", function()
			local res = call({ op = "start", mode = "endless" })
			if res.state then
				lastResult = nil
				board.floor = -1
				applyState(res.state, {})
			end
		end, { LayoutOrder = 70, Parent = deathCard, TextColor3 = C.gold })
		button("Back to the surface", function()
			inRun = false
			local res = call({ op = "profile" })
			profile = res.profile or profile
			showMenu()
		end, { LayoutOrder = 71, Parent = deathCard })
		show("death")
	else
		show("hud")
	end
	-- The HUD stays up under the overlays during a run.
	screens.hud.Visible = phase ~= "dead"
	screens.racepanel.Visible = s.mode == "race" and phase ~= "dead"
	local touch = UserInputService.TouchEnabled
	screens.dpad.Visible = phase == "play" and touch
	screens.hint.Visible = phase == "play" and not touch
end

-- ---------- menus ----------

local menuScreen, menuCard = overlay("Menu", 520)
local ossuaryScreen, ossuaryCard = overlay("Ossuary", 560)
local boardsScreen, boardsCard = overlay("Boards", 520)
local howScreen, howCard = overlay("HowTo", 520)
screens.menu = menuScreen
screens.ossuary = ossuaryScreen
screens.boards = boardsScreen
screens.howto = howScreen
local shopScreen, shopCard = overlay("Shop", 560)
screens.shop = shopScreen
menuScreen.BackgroundTransparency = 0.45

-- ---------- the Crypt Race ----------

local raceState = nil -- the latest race view from the server
local raceLobbyScreen, raceLobbyCard = overlay("RaceLobby", 520)
local raceWatchScreen, raceWatchCard = overlay("RaceWatch", 520)
local raceResultsScreen, raceResultsCard = overlay("RaceResults", 520)
screens.racelobby = raceLobbyScreen
screens.racewatch = raceWatchScreen
screens.raceresults = raceResultsScreen

local function clock(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	return string.format("%d:%02d", seconds // 60, seconds % 60)
end

local function standingsList(parent: Instance, race, order: number?)
	local box = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, LayoutOrder = order or 0, Parent = parent }, { corner(8), pad(10), list(4) })
	if #race.standings == 0 then
		text({ Text = "No racers yet.", TextColor3 = C.dim, Parent = box })
	end
	for _, r in race.standings do
		local status = if r.left then "left" elseif race.phase == "lobby" or race.phase == "countdown" then "ready" elseif r.alive then `❤ {r.hp}/{r.maxHp}` else "fallen"
		text({
			Text = `{r.rank}.  {r.name}  —  floor {r.floor} · {r.kills} kills · {status}`,
			TextXAlignment = Enum.TextXAlignment.Left,
			TextSize = 15,
			TextColor3 = if r.you then C.gold elseif r.left or (not r.alive and race.phase == "running") then C.dim else C.text,
			Parent = box,
		})
	end
	return box
end

-- Live standings beside the board during a race.
local racePanel = new("Frame", {
	Name = "RacePanel",
	AnchorPoint = Vector2.new(1, 0),
	Position = UDim2.new(1, -12, 0, 140),
	Size = UDim2.fromOffset(210, 0),
	AutomaticSize = Enum.AutomaticSize.Y,
	BackgroundColor3 = C.panel,
	BackgroundTransparency = 0.15,
	Visible = false,
	Parent = gui,
}, { corner(10), stroke(C.line), pad(10), list(4, false, Enum.HorizontalAlignment.Left) })
screens.racepanel = racePanel

local function renderRacePanel()
	clear(racePanel)
	local race = raceState
	if not race then
		return
	end
	text({ Text = `RACE · {clock(race.secondsLeft)}`, Font = HEADING, TextSize = 14, TextColor3 = if race.secondsLeft <= 30 then C.red else C.gold, TextXAlignment = Enum.TextXAlignment.Left, Parent = racePanel })
	for _, r in race.standings do
		if not r.left then
			text({
				Text = `{r.rank}. {r.name}  F{r.floor}` .. (if r.alive then "" else " ☠"),
				TextSize = 13,
				TextXAlignment = Enum.TextXAlignment.Left,
				TextColor3 = if r.you then C.gold elseif r.alive then C.text else C.dim,
				Parent = racePanel,
			})
		end
	end
end

menus.renderRaceLobby = function()
	clear(raceLobbyCard)
	local race = raceState
	text({ Text = "CRYPT RACE", Font = HEADING, TextSize = 30, TextColor3 = C.gold, Parent = raceLobbyCard })
	text({ Text = `Everyone races through the same crypt with the same hero. Deepest floor after {clock(race and race.length or 300)} wins.`, TextColor3 = C.dim, Parent = raceLobbyCard })
	if not race then
		return
	end
	local status
	if race.queued then
		status = "A race is under way. You're in the next one."
	elseif race.phase == "lobby" then
		status = `Waiting for racers ({race.count}/{race.max}). The race starts once {race.min} have joined.`
	elseif race.phase == "countdown" then
		status = `The race starts in {race.secondsLeft}…`
	elseif race.phase == "running" then
		status = `A race is under way ({clock(race.secondsLeft)} left).`
	else
		status = `Next race opens in {race.secondsLeft}…`
	end
	text({ Text = status, Font = BOLD, TextColor3 = C.gold, Parent = raceLobbyCard })
	text({ Text = `Prizes: 🏆 {race.prizes[1]} · {race.prizes[2]} · {race.prizes[3]} Souls, on top of the run's own Souls.`, TextSize = 14, TextColor3 = C.dim, Parent = raceLobbyCard })
	if race.phase == "lobby" or race.phase == "countdown" then
		standingsList(raceLobbyCard, race)
	end
	text({ Text = "Invite friends to this server, or rent a Private Server, to race together.", TextSize = 12, TextColor3 = C.dim, Parent = raceLobbyCard })
	button("Leave", function()
		local res = call({ op = "raceLeave" })
		raceState = res.race or raceState
		profile = res.profile or profile
		showMenu()
	end, { Parent = raceLobbyCard })
end

menus.renderRaceWatch = function()
	clear(raceWatchCard)
	local race = raceState
	text({ Text = `YOU FELL ON FLOOR {state and state.floor or 0}`, Font = HEADING, TextSize = 26, TextColor3 = C.red, Parent = raceWatchCard })
	text({ Text = "The race goes on. Souls and prizes are paid when it ends.", TextColor3 = C.dim, Parent = raceWatchCard })
	if race then
		text({ Text = `{clock(race.secondsLeft)} left`, Font = HEADING, TextSize = 18, TextColor3 = C.gold, Parent = raceWatchCard })
		standingsList(raceWatchCard, race)
	end
	button("Leave the race", function()
		inRun = false
		local res = call({ op = "raceLeave" })
		raceState = res.race or raceState
		profile = res.profile or profile
		showMenu()
	end, { Parent = raceWatchCard })
end

local function renderRaceResults(race, you)
	clear(raceResultsCard)
	local mine = nil
	for _, r in race.results do
		if r.name == (player.DisplayName or player.Name) then
			mine = r
		end
	end
	local rank = you and you.rank or (mine and mine.rank) or 0
	text({ Text = if rank == 1 then "🏆 YOU WON THE RACE" else `RACE OVER · #{rank}`, Font = HEADING, TextSize = 26, TextColor3 = C.gold, Parent = raceResultsCard })
	local box = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = raceResultsCard }, { corner(8), pad(10), list(4) })
	for _, r in race.results do
		text({
			Text = `{r.rank}.  {r.name}  —  floor {r.floor} · {r.kills} kills` .. (if r.left then " · left" else `  +{r.souls} Souls`),
			TextXAlignment = Enum.TextXAlignment.Left,
			TextSize = 15,
			TextColor3 = if r.rank == rank then C.gold else C.text,
			Parent = box,
		})
	end
	if you then
		local mineBox = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = raceResultsCard }, { corner(8), pad(10), list(3) })
		for _, l in you.lines do
			text({ Text = `{l.label}   +{l.souls}`, TextSize = 15, Parent = mineBox })
		end
		text({ Text = `+{you.total} Souls`, Font = HEADING, TextSize = 22, TextColor3 = C.gold, Parent = mineBox })
	end
	button("Race again", function()
		local res = call({ op = "raceJoin" })
		raceState = res.race or raceState
		if res.error then
			showToast(res.error, C.red)
		end
		show("racelobby")
		menus.renderRaceLobby()
	end, { Parent = raceResultsCard, TextColor3 = C.gold })
	button("Back to the surface", function()
		local res = call({ op = "profile" })
		profile = res.profile or profile
		showMenu()
	end, { Parent = raceResultsCard })
	show("raceresults")
end

local function onRacePush(msg)
	raceState = msg.race or raceState
	if msg.kind == "raceStart" then
		inRun = true
		queue = {}
		lastResult = nil
		board.floor = -1
		clearUnits()
		clearGhosts()
		applyState(msg.state, {})
		showBanner(`RACE! · {msg.race.heroName}`, C.gold)
		sound(SFX.pick, 0.5, 1.2)
	elseif msg.kind == "raceEnd" then
		inRun = false
		clearGhosts()
		renderRaceResults(msg.race, msg.you)
		sound(SFX.pick, 0.6, 0.8)
		return
	end
	-- Keep whatever race screen is up current.
	if screens.racelobby.Visible then
		menus.renderRaceLobby()
	elseif screens.racewatch.Visible then
		menus.renderRaceWatch()
	elseif screens.menu.Visible and menus.raceLine then
		menus.raceLine()
	end
	if inRun and state and state.mode == "race" then
		renderRacePanel()
		updateGhosts(raceState, if state.phase ~= "dead" then state.floor else nil)
	else
		updateGhosts(nil)
	end
end

local function startRun(mode: string, hero: string?)
	local res = call({ op = "start", mode = mode, hero = hero })
	if res.error then
		showToast(res.error, C.red)
		if res.profile then
			profile = res.profile
			showMenu()
		end
		return
	end
	inRun = true
	queue = {}
	lastResult = nil
	board.floor = -1
	clearUnits()
	applyState(res.state, {})
	if res.state.floor == 1 and res.state.turns == 0 then
		showBanner(if mode == "daily" then `DAILY #{res.state.dailyNo}` else "ENDLESS", C.gold)
	end
end

local countdownLabel = nil
local presenceLabel = nil

local function updatePresence()
	if presenceLabel and presenceLabel.Parent then
		local n = presence.Value
		presenceLabel.Text = `{n} soul{if n == 1 then "" else "s"} in this crypt right now`
	end
end
presence.Changed:Connect(updatePresence)

--- A still room behind the menus: the hero waiting at the foot of the stairs.
local function showPreview()
	local preview = {
		floor = 0, boss = false, walls = { 8, 12, 22, 26, 36, 40 }, spikes = { 30 }, stairs = { x = 3, y = 0 },
		stairsOpen = true, warnings = {}, enemies = {}, feature = nil, potion = nil,
	}
	buildBoard(preview)
	refreshBoard(preview)
	board.floor = -1
	local hero = newUnit("hero", "hero", false, profile and profile.hero or "knight")
	placeUnit(hero, 3, 4, 1, true)
	for i, kind in { "ghoul", "bat", "archer" } do
		local u = newUnit("preview" .. i, kind, false)
		placeUnit(u, ({ 1, 3, 5 })[i], ({ 2, 1, 2 })[i], if i == 3 then -1 else 1, true)
		u.gui.Enabled = false
	end
end

showMenu = function()
	inRun = false
	clearUnits()
	clearGhosts()
	clear(menuCard)
	local p = profile
	cosmetics = p.cosmetics
	text({ Text = "ONE MORE CRYPT", Font = HEADING, TextSize = 40, TextColor3 = C.gold, Parent = menuCard })
	text({ Text = "Same crypt for everyone. One attempt a day.", TextColor3 = C.dim, Parent = menuCard })
	text({ Text = `⚱ {p.souls} Souls` .. (if p.cosmetics.crown then "  ·  👑 Crypt Founder" else ""), Font = BOLD, TextColor3 = C.gold, Parent = menuCard })

	-- Daily card.
	local d = p.daily
	local daily = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = menuCard }, { corner(10), stroke(C.gold, 1.5), pad(14), list(6) })
	text({ Text = `DAILY DESCENT #{d.number}`, Font = HEADING, TextSize = 24, TextColor3 = C.gold, Parent = daily })
	text({ Text = `Hero of the day: {d.hero}`, Parent = daily })
	if d.resumable then
		text({ Text = `Your descent is waiting on floor {d.played}.`, TextColor3 = C.dim, Parent = daily })
		button("Resume the descent", function()
			startRun("daily")
		end, { Parent = daily, TextColor3 = C.gold })
	elseif d.played then
		text({ Text = `You reached floor {d.played} today. Come back tomorrow, or practise in Endless.`, TextColor3 = C.dim, Parent = daily })
	else
		text({ Text = "One official attempt. Everyone gets the same crypt (the same one as onemorecrypt.com).", TextColor3 = C.dim, Parent = daily })
		button("Descend", function()
			startRun("daily")
		end, { Parent = daily, TextColor3 = C.gold })
	end
	countdownLabel = text({ Text = "", TextSize = 13, TextColor3 = C.dim, Parent = daily })

	-- Multiplayer card.
	local raceCard = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = menuCard }, { corner(10), stroke(C.ice, 1.5), pad(14), list(6) })
	text({ Text = "⚔ CRYPT RACE", Font = HEADING, TextSize = 24, TextColor3 = C.ice, Parent = raceCard })
	text({ Text = "Multiplayer: race everyone in this server through the same crypt. Deepest floor in 5 minutes wins Souls.", TextColor3 = C.dim, Parent = raceCard })
	local raceInfo = text({ Text = "", TextSize = 14, Font = BOLD, TextColor3 = C.ice, Parent = raceCard })
	menus.raceLine = function()
		local r = raceState
		if not raceInfo.Parent or not r then
			return
		end
		raceInfo.Text = if r.phase == "running" then `A race is under way · {r.count} racing · {clock(r.secondsLeft)} left`
			elseif r.phase == "countdown" then `{r.count} racers ready · starts in {r.secondsLeft}`
			elseif r.phase == "results" then "A race just finished · next one opening"
			else `{r.count} waiting in the lobby`
	end
	menus.raceLine()
	button("Join the race", function()
		local res = call({ op = "raceJoin" })
		raceState = res.race or raceState
		if res.error then
			showToast(res.error, C.red)
		end
		show("racelobby")
		menus.renderRaceLobby()
	end, { Parent = raceCard, TextColor3 = C.ice })

	-- Endless card.
	local endless = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = menuCard }, { corner(10), stroke(), pad(14), list(6) })
	text({ Text = "ENDLESS", Font = HEADING, TextSize = 24, Parent = endless })
	text({ Text = `Random crypts for practice. Best depth: floor {p.bestEndless}.`, TextColor3 = C.dim, Parent = endless })
	local heroRow = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Parent = endless }, {
		new("UIGridLayout", { CellSize = UDim2.new(0.25, -6, 0, 40), CellPadding = UDim2.fromOffset(6, 6), SortOrder = Enum.SortOrder.LayoutOrder }),
	})
	local selected = nil
	for i, h in p.heroes do
		if h.owned then
			local b = button(h.name, function()
				local res = call({ op = "pickHero", id = h.id })
				profile = res.profile or profile
				showMenu()
			end, { LayoutOrder = i, TextSize = 14, Parent = heroRow })
			if h.id == p.hero then
				b:FindFirstChildOfClass("UIStroke").Color = C.gold
				b.TextColor3 = C.gold
				selected = h
			end
		end
	end
	if selected then
		text({ Text = `{selected.name} · {selected.hp} HP · {selected.perk}: {selected.perkDesc}`, TextSize = 14, TextColor3 = C.dim, Parent = endless })
	end
	local cloakPass = nil
	for _, pass in p.store.passes do
		if pass.key == "cloaks" then
			cloakPass = pass
		end
	end
	if cloakPass and cloakPass.owned then
		local cloakRow = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Parent = endless }, {
			new("UIGridLayout", { CellSize = UDim2.new(1 / 7, -5, 0, 34), CellPadding = UDim2.fromOffset(5, 5), SortOrder = Enum.SortOrder.LayoutOrder }),
		})
		local options = { { key = "", name = "Own" } }
		for _, c in p.store.cloaks do
			table.insert(options, c)
		end
		for i, c in options do
			local b = button(c.name, function()
				local res = call({ op = "pickCloak", key = c.key })
				profile = res.profile or profile
				showMenu()
			end, { LayoutOrder = i, TextSize = 11, Parent = cloakRow })
			local col = Store.cloakByKey(c.key)
			if col then
				b.BackgroundColor3 = col.p
			end
			if c.key == p.cosmetics.cloak then
				b:FindFirstChildOfClass("UIStroke").Color = C.gold
				b:FindFirstChildOfClass("UIStroke").Thickness = 3
			end
		end
	end
	if p.endlessResumable then
		button("Resume Endless run", function()
			startRun("endless", "resume")
		end, { Parent = endless, TextColor3 = C.gold })
	end
	button("Begin a new Endless run", function()
		startRun("endless", p.hero)
	end, { Parent = endless })

	local row = new("Frame", { Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = menuCard }, {
		new("UIGridLayout", { CellSize = UDim2.new(1 / 2, -3, 0, 44), CellPadding = UDim2.fromOffset(6, 6) }),
	})
	row.Size = UDim2.new(1, 0, 0, 94)
	button("🛒 Shop", function()
		show("shop")
		menus.renderShop()
	end, { Parent = row, TextColor3 = C.gold })
	button("Ossuary", function()
		show("ossuary")
		menus.renderOssuary()
	end, { Parent = row })
	button("Leaderboards", function()
		show("boards")
		menus.renderBoards("daily")
	end, { Parent = row })
	button("How to play", function()
		show("howto")
	end, { Parent = row })
	if not p.online then
		text({ Text = "Progress is not being saved on this server (DataStores are off).", TextSize = 12, TextColor3 = C.red, Parent = menuCard })
	end
	presenceLabel = text({ Text = "", TextSize = 13, TextColor3 = C.dim, Parent = menuCard })
	updatePresence()
	showPreview()
	show("menu")
	camera.CameraType = Enum.CameraType.Scriptable
end

menus.renderOssuary = function()
	clear(ossuaryCard)
	local p = profile
	text({ Text = "THE OSSUARY", Font = HEADING, TextSize = 30, TextColor3 = C.gold, Parent = ossuaryCard })
	text({ Text = `Trade Souls for heroes and forbidden relics for Endless. You have ⚱ {p.souls}.`, TextColor3 = C.dim, Parent = ossuaryCard })
	text({ Text = "HEROES", Font = HEADING, TextSize = 18, Parent = ossuaryCard })
	for _, h in p.heroes do
		local label = if h.owned then `{h.name} · owned` else `{h.name} · ⚱ {h.cost}`
		local b = button(label .. `\n{h.perk}: {h.perkDesc}`, function()
			if not h.owned then
				local res = call({ op = "buyHero", id = h.id })
				profile = res.profile or profile
				menus.renderOssuary()
			end
		end, { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextSize = 14, Parent = ossuaryCard })
		b.TextColor3 = if h.owned then C.dim elseif p.souls >= h.cost then C.gold else C.text
		new("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8), PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8), Parent = b })
	end
	text({ Text = "FORBIDDEN RELICS", Font = HEADING, TextSize = 18, Parent = ossuaryCard })
	for _, r in p.forbidden do
		local label = if r.owned then `{r.emoji} {r.name} · unlocked` else `{r.emoji} {r.name} · ⚱ {r.cost}`
		local b = button(label .. `\n{r.desc}`, function()
			if not r.owned then
				local res = call({ op = "buyRelic", id = r.id })
				profile = res.profile or profile
				menus.renderOssuary()
			end
		end, { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, TextSize = 14, Parent = ossuaryCard })
		b.TextColor3 = if r.owned then C.dim elseif p.souls >= r.cost then C.gold else C.text
		new("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingBottom = UDim.new(0, 8), PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8), Parent = b })
	end
	button("Back", function()
		showMenu()
	end, { Parent = ossuaryCard })
end

menus.renderBoards = function(which: string)
	clear(boardsCard)
	text({ Text = "LEADERBOARDS", Font = HEADING, TextSize = 30, TextColor3 = C.gold, LayoutOrder = 1, Parent = boardsCard })
	local tabs = new("Frame", { Size = UDim2.new(1, 0, 0, 40), BackgroundTransparency = 1, LayoutOrder = 2, Parent = boardsCard }, {
		new("UIGridLayout", { CellSize = UDim2.new(0.5, -4, 0, 40), CellPadding = UDim2.fromOffset(8, 0) }),
	})
	button("Today's daily", function()
		menus.renderBoards("daily")
	end, { Parent = tabs, TextColor3 = if which == "daily" then C.gold else C.text })
	button("Endless", function()
		menus.renderBoards("endless")
	end, { Parent = tabs, TextColor3 = if which == "endless" then C.gold else C.text })
	local loading = text({ Text = "Reading the tombstones…", TextColor3 = C.dim, LayoutOrder = 3, Parent = boardsCard })
	button("Back", function()
		showMenu()
	end, { LayoutOrder = 20, Parent = boardsCard })
	task.spawn(function()
		local res = call({ op = "board", board = which })
		if loading.Parent then
			loading.Text = res.title or ""
			boardList(boardsCard, res.board or {}, 4)
		end
	end)
end

local priceCache = {}
--- The real Robux price set in the Creator Dashboard, falling back to the suggested one.
local function priceOf(id: number, infoType, fallback: number, label: TextLabel)
	label.Text = `R$ {fallback}`
	if id == 0 then
		return
	end
	if priceCache[id] then
		label.Text = `R$ {priceCache[id]}`
		return
	end
	task.spawn(function()
		local ok, info = pcall(MarketplaceService.GetProductInfo, MarketplaceService, id, infoType)
		if ok and info and info.PriceInRobux then
			priceCache[id] = info.PriceInRobux
			if label.Parent then
				label.Text = `R$ {info.PriceInRobux}`
			end
		end
	end)
end

local function shopItem(emoji: string, name: string, desc: string, id: number, infoType, fallback: number, owned: boolean, onBuy: () -> ())
	local box = new("Frame", { Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = C.panel2, Parent = shopCard }, {
		corner(10), stroke(if owned then C.green else C.line), pad(12), list(6, false, Enum.HorizontalAlignment.Left),
	})
	text({ Text = `{emoji}  {name}`, Font = BOLD, TextSize = 18, TextColor3 = C.gold, TextXAlignment = Enum.TextXAlignment.Left, Parent = box })
	text({ Text = desc, TextSize = 14, TextXAlignment = Enum.TextXAlignment.Left, Parent = box })
	if owned then
		text({ Text = "✓ Owned", Font = BOLD, TextColor3 = C.green, TextXAlignment = Enum.TextXAlignment.Left, Parent = box })
	elseif id == 0 then
		text({ Text = "Not on sale yet", TextColor3 = C.dim, TextXAlignment = Enum.TextXAlignment.Left, Parent = box })
	else
		local b = button("", onBuy, { Size = UDim2.new(0, 140, 0, 38), TextColor3 = C.gold, Parent = box })
		local label = text({ Size = UDim2.fromScale(1, 1), AutomaticSize = Enum.AutomaticSize.None, Font = BOLD, TextColor3 = C.gold, Parent = b })
		priceOf(id, infoType, fallback, label)
	end
end

menus.renderShop = function()
	clear(shopCard)
	local st = profile.store
	text({ Text = "THE CRYPT SHOP", Font = HEADING, TextSize = 30, TextColor3 = C.gold, Parent = shopCard })
	text({ Text = "Cosmetics and Souls. Nothing here changes the Daily Descent: everyone braves the same crypt.", TextColor3 = C.dim, Parent = shopCard })
	text({ Text = "GAME PASSES", Font = HEADING, TextSize = 18, Parent = shopCard })
	for _, pass in st.passes do
		shopItem(pass.emoji, pass.name, pass.desc, pass.id, Enum.InfoType.GamePass, pass.price, pass.owned, function()
			MarketplaceService:PromptGamePassPurchase(player, pass.id)
		end)
	end
	text({ Text = "SOULS", Font = HEADING, TextSize = 18, Parent = shopCard })
	text({ Text = `You have ⚱ {profile.souls}. Spend Souls in the Ossuary on heroes and forbidden relics for Endless.`, TextColor3 = C.dim, Parent = shopCard })
	for _, prod in st.products do
		shopItem(prod.emoji, prod.name, `{prod.souls} Souls`, prod.id, Enum.InfoType.Product, prod.price, false, function()
			MarketplaceService:PromptProductPurchase(player, prod.id)
		end)
	end
	if st.premium then
		text({ Text = `⭐ Premium member: +{math.floor(st.premiumBonus * 100)}% Souls on every run.`, TextColor3 = C.gold, Parent = shopCard })
	else
		text({ Text = `⭐ Roblox Premium members earn +{math.floor(st.premiumBonus * 100)}% Souls on every run.`, TextColor3 = C.dim, Parent = shopCard })
	end
	button("Back", function()
		showMenu()
	end, { Parent = shopCard })
end

-- Purchases land on the server; it tells us here so the menus can catch up.
pushEvent.OnClientEvent:Connect(function(msg)
	if msg.kind == "race" or msg.kind == "raceStart" or msg.kind == "raceEnd" then
		onRacePush(msg)
		return
	end
	if msg.kind == "souls" then
		showToast(`{msg.name}: +{msg.amount} Souls`, C.gold)
	elseif msg.kind == "pass" then
		showToast(`{msg.name} unlocked. Thank you!`, C.gold)
	end
	sound(SFX.pick, 0.5)
	local res = call({ op = "profile" })
	if res.profile then
		profile = res.profile
		cosmetics = profile.cosmetics
		if screens.shop.Visible then
			menus.renderShop()
		elseif screens.menu.Visible then
			showMenu()
		end
	end
end)

do
	text({ Text = "HOW TO PLAY", Font = HEADING, TextSize = 30, TextColor3 = C.gold, Parent = howCard })
	local rules = {
		"🗺  Every floor is a 7×7 room. Every move you make, every foe makes one.",
		"⚔  Walk into a foe to attack it. Kill everything to unseal the stairs, then step on them.",
		"🏮  After each floor, take 1 of 3 relics or rest. Relics stack: 2 Vampire Fangs heal for 2.",
		"🏹  Skeleton Archers aim first: a red line shows where the arrow will fly. Step out of it.",
		"☠  A boss waits every 5th floor. Purple and green tiles flash where a boss spell will land.",
		"🪤  Spikes hurt whoever walks on them. Lure foes across them.",
		"🩸  Shrines, chests and fountains offer deals. The Soul Forge, after each boss, fuses two relics.",
		"⏳  Space (or the hourglass) waits a turn: let foes come to you.",
		"⚔  Crypt Race (multiplayer): everyone who joins races through the same crypt with the same hero. Deepest floor after 5 minutes wins extra Souls. Rivals on your floor show up as ghosts.",
		"📅  The Daily Descent is the same crypt for everyone, and the same as on onemorecrypt.com. One attempt a day.",
		"⚱  Every run earns Souls. Spend them in the Ossuary on heroes and forbidden relics for Endless.",
		"🎮  Move: WASD, arrows or HJKL · on phones swipe, tap a tile or use the d-pad.",
	}
	for _, r in rules do
		text({ Text = r, TextXAlignment = Enum.TextXAlignment.Left, TextSize = 15, Parent = howCard })
	end
	button("Back", function()
		showMenu()
	end, { Parent = howCard })
end

-- Countdown to the next daily.
task.spawn(function()
	while true do
		if countdownLabel and countdownLabel.Parent then
			countdownLabel.Text = "Next crypt in " .. Daily.countdown(Daily.secondsUntilNext())
		end
		task.wait(1)
	end
end)

-- Gentle idle bob for the potion and a slow spin on the hero's torchlight.
RunService.RenderStepped:Connect(function()
	if board.potion and board.potion.PrimaryPart and state and state.potion then
		local t = os.clock()
		board.potion.PrimaryPart.CFrame = CFrame.new(tilePos(state.potion.x, state.potion.y) + Vector3.new(0, 0.3 + math.sin(t * 3) * 0.2, 0)) * CFrame.Angles(-LEAN, 0, 0) * CFrame.Angles(0, math.sin(t) * 0.4, 0)
	end
end)

-- ---------- boot ----------

do
	-- A preview room behind the menu.
	local loading = text({ Text = "Opening the crypt…", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Font = HEADING, TextSize = 26, TextColor3 = C.gold, Parent = gui })
	local res = call({ op = "profile" })
	while not res.profile do
		task.wait(1)
		res = call({ op = "profile" })
	end
	loading:Destroy()
	profile = res.profile
	cosmetics = profile.cosmetics
	showMenu()
end
