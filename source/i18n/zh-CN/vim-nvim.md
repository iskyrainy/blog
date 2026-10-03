---
title: Vim Nvim
category: Tech
tag: Vim
date: 2025-09-20T16:02:35+08:00
---


# Vim-nvim

## 什么是 Neovim？
**Neovim**<sup>[1]</sup> 是 *Vim* 的一个分支，旨在改进代码库，以便更容易实现 API、提升用户体验和插件实现。

Neovim(nvim) 本质上是 Vim 的一个现代化、异步且高度可扩展的版本，专为更好的插件支持、类 IDE 功能、性能改进以及基于 Lua 的配置而设计，同时保留与大多数 Vim 工作流程的兼容性。

| 特性 / 方面                       | Vim                      | Neovim                                                                |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| **异步插件**                      | 有限 / 阻塞              | 完全异步、非阻塞                                                      |
| **语言服务器协议**                | 仅外部插件               | 内置 LSP 客户端（`vim.lsp`）                                          |
| **插件语言支持**                  | Vimscript                | Vimscript + Lua + 任意语言的远程插件（Python、Ruby 等）               |
| **配置**                          | `vimrc`（Vimscript）     | `init.vim`（Vimscript）或 `init.lua`（Lua）                           |
| **嵌入式终端**                    | 非内置                   | 内置终端（`:terminal`）                                               |
| **UI 架构**                       | 单体式                   | 核心与 UI 解耦 → 支持外部 GUI                                         |
| **性能（并发）**                  | 单线程                   | 事件循环 + 异步任务 → 处理繁重任务更流畅                              |
| **语法高亮 / 解析**               | 基于正则                 | Treesitter 集成 → 精准解析、折叠、高亮                                |
| **社区与开发**                    | 更新较慢、稳定           | 活跃开发、现代插件生态                                                |
| **向后兼容性**                    | 完全支持 Vimscript       | 大部分兼容 Vimscript + 新 API                                         |

以下是在 Linux 上安装 nvim：
```bash
# 根据你的平台和架构进行修改
curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz
sudo rm -rf /opt/nvim-linux-x86_64
sudo tar -C /opt -xzf nvim-linux-x86_64.tar.gz
# 将 nvim bin 导出到 Path
echo "export PATH=\$PATH:/opt/nvim-linux-x86_64/bin" >> ~/.bashrc
source ~/.bashrc
rm -f nvim-linux-x86_64.tar.gz
```

## 配置 neovim
`nivm` 可以使用 `lua` 语言进行配置。配置编辑器、键位映射和插件等非常容易。

一个简单的配置结构如下：
```bash
.
├── init.lua
├── lazy-lock.json
└── lua
    ├── core
    │   ├── keymaps.lua
    │   └── options.lua
    └── plugins
        ├── completion.lua
        ├── git.lua
        ├── init.lua
        ├── lang.lua
        ├── lsp.lua
        ├── treesitter.lua
        ├── ui.lua
        └── utils.lua
```

让我们看看这些 `.lua` 文件：
- `init.lua`：Neovim 配置入口点，保持重新加载这些文件
- `lua`：
    - `lua/core`：配置编辑器和键位绑定
        - `keymaps.lua`：配置键位绑定
        - `options.lua`：配置编辑器
    - `lua/plugins`：配置不同的插件
        - `completion.lua`：代码补全插件
        - `git.lua`：git 功能增强插件
        - `init.lua`：初始化 `lazy`<sup>[2]</sup> 包管理器
        - `lang.lua`：语言功能增强插件
        - `lsp.lua`：配置 `nvim-lspconfig`<sup>[3]</sup> 插件
        - `treesitter.lua`：配置 `treesitter`<sup>[4]</sup> 插件
        - `ui.lua`：配置主题/状态栏/文件树/缓冲行/光标增强
        - `utils.lua`：功能增强插件，如：`telescope`、`Comment`、`autopairs`、`dap`、`trouble` 等

> 所有配置文件都管理在仓库 [*iskyrainy/NvimConfig*](https://github.com/iskyrainy/NvimConfig) 中。

### `init.lua`
```lua
-- 基础配置
require("core.options")
require("core.keymaps")

-- 插件入口点
require("plugins")
```

### `lua/core/keymaps.lua`
```lua
vim.g.mapleader = ","
vim.g.maplocalleader = ","

local keymap = vim.keymap

-- ---------- 插入模式 ---------- ---
keymap.set("i", "jk", "<ESC>", { desc = "退出插入模式" })

-- ---------- 可视模式 ---------- ---
keymap.set("v", "J", ":m '>+1<CR>gv=gv", { desc = "向下移动行" })
keymap.set("v", "K", ":m '<-2<CR>gv=gv", { desc = "向上移动行" })
vim.keymap.set("v", "<leader>y", '"+y', { desc = "复制到系统剪贴板" })

-- ---------- 普通模式 ---------- ---
-- 窗口
-- 水平分割窗口
vim.keymap.set("n", "<leader>sh", "<C-w>s", { desc = "水平分割窗口" })

-- 垂直分割窗口
vim.keymap.set("n", "<leader>sv", "<C-w>v", { desc = "垂直分割窗口" })

-- 关闭当前窗口
vim.keymap.set("n", "<leader>sc", "<C-w>c", { desc = "关闭当前窗口" })

-- 关闭其他所有窗口
vim.keymap.set("n", "<leader>so", "<C-w>o", { desc = "关闭其他窗口" })


-- 通过 <leader> + h/j/k/l 切换窗口
vim.keymap.set("n", "<leader>h", "<C-w>h", { desc = "移动到左侧窗口" })
vim.keymap.set("n", "<leader>l", "<C-w>l", { desc = "移动到右侧窗口" })
vim.keymap.set("n", "<leader>j", "<C-w>j", { desc = "移动到下方窗口" })
vim.keymap.set("n", "<leader>k", "<C-w>k", { desc = "移动到上方窗口" })

-- 通过 Alt + h/j/k/l 调整窗口大小
vim.keymap.set("n", "<A-l>", "<C-w><", { desc = "减小宽度" })
vim.keymap.set("n", "<A-h>", "<C-w>>", { desc = "增加宽度" })
vim.keymap.set("n", "<A-j>", "<C-w>-", { desc = "减小高度" })
vim.keymap.set("n", "<A-k>", "<C-w>+", { desc = "增加高度" })

-- 均分所有窗口
vim.keymap.set("n", "<leader>se", "<C-w>=", { desc = "均分窗口大小" })


-- 取消高亮
keymap.set("n", "<leader>nh", ":nohl<CR>", { desc = "关闭高亮" })

-- 切换缓冲区
keymap.set("n", "<leader>q", ":bd<CR>", { desc = "关闭当前缓冲区" })
keymap.set("n", "<F7>", ":bprevious<CR>", { desc = "移动到上一个缓冲区" })
keymap.set("n", "<F8>", ":bnext<CR>", { desc = "移动到下一个缓冲区" })

-- 系统剪贴板
vim.keymap.set("n", "<leader>p", '"+p', { desc = "从系统剪贴板粘贴" })
vim.keymap.set("n", "<leader>y", '"+yy', { desc = "复制行到系统剪贴板" })

-- ---------- 插件 ---------- ---
-- nvim-tree
vim.keymap.set("n", "<F4>", "<cmd>NvimTreeToggle<CR>", { noremap = true, silent = true }, { desc = "打开/关闭文件树" })

-- treesitter
vim.keymap.set("n", "<leader>f", "gg=G", { desc = "格式化代码" })

-- lsp
vim.keymap.set("n", "ga", vim.diagnostic.open_float, { desc = "打开诊断信息" })
vim.keymap.set("n", "gk", vim.diagnostic.goto_prev, { desc = "移动到上一条诊断信息" })
vim.keymap.set("n", "gj", vim.diagnostic.goto_next, { desc = "移动到下一条诊断信息" })
vim.keymap.set("n", "gd", vim.lsp.buf.definition, { desc = "跳转到定义" })
vim.keymap.set("n", "gD", vim.lsp.buf.declaration, { desc = "跳转到声明" })
vim.keymap.set("n", "gt", vim.lsp.buf.type_definition, { desc = "跳转到类型定义" })
vim.keymap.set("n", "gi", vim.lsp.buf.implementation, { desc = "跳转到实现" })
vim.keymap.set("n", "gr", vim.lsp.buf.references, { desc = "显示所有引用" })
vim.keymap.set("n", "K", vim.lsp.buf.hover, { desc = "显示悬浮信息" })
vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, {desc = "重命名变量" } )
vim.keymap.set({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, { desc = "代码操作" })
vim.keymap.set("n", "<leader>fm", function()
  vim.lsp.buf.format({ async = true })
end)

-- autocmd
-- 当 Cargo.toml 改变时自动重载 rust-analyzer
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = "Cargo.toml",
  callback = function()
    vim.lsp.buf.execute_command({ command = "rust-analyzer.reloadWorkspace" })
  end,
})

-- 自动保存文件更改
vim.api.nvim_create_autocmd({ "InsertLeave", "TextChanged" }, {
  pattern = "*",
  callback = function()
    if vim.bo.modified then
      vim.cmd("silent! write")
    end
  end,
})
```

### `lua/core/options.lua`
```lua
local opt = vim.opt

-- 行号
opt.relativenumber = true
opt.number = true

-- 制表符
opt.tabstop = 2
opt.shiftwidth = 2
opt.expandtab = true
opt.autoindent = true

-- 不换行
opt.wrap = false

-- 光标行
opt.cursorline = true

-- 启用鼠标
opt.mouse:append("a")

-- 系统剪贴板
-- Linux 需要安装 `xclip`/`xsel`，MacOS 需要安装 `pbcopy`/`pbpaste`
opt.clipboard:append("unnamedplus")

-- 新窗口位置
opt.splitright = true
opt.splitbelow = true

-- 搜索
opt.ignorecase = true
opt.smartcase = true

-- 主题
opt.termguicolors = true
opt.signcolumn = "yes"
```

### `lua/plugins/completion.lua`
```lua
return {
  { "hrsh7th/nvim-cmp", dependencies = {
      "hrsh7th/cmp-nvim-lsp",
      "hrsh7th/cmp-buffer",
      "hrsh7th/cmp-path",
      "L3MON4D3/LuaSnip",
    },
    config = function()
      local cmp = require("cmp")
      cmp.setup({
        snippet = { expand = function(args) require("luasnip").lsp_expand(args.body) end },
        mapping = cmp.mapping.preset.insert({
          ["<C-Space>"] = cmp.mapping.complete(),
          ["<CR>"] = cmp.mapping.confirm({ select = true }),
        }),
        sources = cmp.config.sources({
          { name = "nvim_lsp" },
          { name = "buffer" },
          { name = "path" },
        }),
      })
    end
  },
}
```

### `lua/plugins/git.lua`
```lua
return {
  { "lewis6991/gitsigns.nvim", config = function()
      require("gitsigns").setup()
    end
  },
  { "tpope/vim-fugitive" },
}
```

### `lua/plugins/init.lua`
```lua
-- lazy.nvim 初始化
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable", lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  { import = "plugins.ui" },
  { import = "plugins.lsp" },
  { import = "plugins.completion" },
  { import = "plugins.treesitter" },
  { import = "plugins.git" },
  { import = "plugins.utils" },
  { import = "plugins.lang" },
})
```

### `lua/plugins/lang.lua`
```lua
return {
  { "simrat39/rust-tools.nvim", dependencies = "neovim/nvim-lspconfig",
    config = function()
      require("rust-tools").setup({})
    end
  },
  { "mfussenegger/nvim-jdtls" },
}
```

### `lua/plugins/lsp.lua`
```lua
return {
  -- Mason：LSP/DAP/工具安装器
  {
    "williamboman/mason.nvim",
    build = ":MasonUpdate",
    config = function()
      require("mason").setup()
    end,
  },

  {
    "neovim/nvim-lspconfig",
    enable = function()
      -- 配置你需要的 lsp 服务器
      -- Lua
      vim.lsp.config('lua_ls', {})
      vim.lsp.enable('lua_ls')

      -- Python
      vim.lsp.config('pyright', {})
      vim.lsp.enable('pyright')

      -- Rust
      vim.lsp.config('rust_analyzer', {})
      vim.lsp.enable('rust_analyzer')
    end,
  },

  { "mfussenegger/nvim-jdtls" },
}
```

### `lua/plugins/treesitter.lua`
```lua
return {
  { "p00f/nvim-ts-rainbow" },
  { "nvim-treesitter/nvim-treesitter", branch = 'master', lazy = false, build = ":TSUpdate", config = function()
      require("nvim-treesitter.configs").setup({
        -- 配置你需要的语言
        ensure_installed = { "lua", "python", "rust", "java", "json", "bash", "markdown", "markdown_inline" },
        highlight = { enable = true },
        indent = { enable = true },
      })
    end
  },
}
```

### `lua/plugins/ui.lua`
```lua
return {
  -- 主题
  { "Mofiqul/vscode.nvim", config = function() vim.cmd.colorscheme "vscode" end },

  -- 状态栏
  { "nvim-lualine/lualine.nvim", dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function() require("lualine").setup({ options = { theme = "vscode" } }) end
  },

  -- 文件树
  { "nvim-tree/nvim-tree.lua", dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function() require("nvim-tree").setup() end
  },

  -- 缓冲行
  { "akinsho/bufferline.nvim", dependencies = "nvim-tree/nvim-web-devicons",
    config = function() require("bufferline").setup() end
  },

  -- 光标增强
  { "sphamba/smear-cursor.nvim",
    opts = {
      smear_between_buffers = true,
      smear_between_neighbor_lines = true,
      scroll_buffer_space = true,
      legacy_computing_symbols_support = true,
      smear_insert_mode = true,
    },
  },
  { "karb94/neoscroll.nvim", config = function() require("neoscroll").setup() end },
```

### `lua/plugins/utils.lua`
```lua
return {
  -- 系统中需要安装 `ripgrep`/`fd`
  { "nvim-telescope/telescope.nvim", tag = "0.1.8", dependencies = { "nvim-lua/plenary.nvim" },
    config = function()
      local builtin = require('telescope.builtin')
      vim.keymap.set('n', '<leader>ff', builtin.find_files, { desc = 'Telescope 查找文件' })
      vim.keymap.set('n', '<leader>fg', builtin.live_grep, { desc = 'Telescope 实时搜索' })
      vim.keymap.set('n', '<leader>fb', builtin.buffers, { desc = 'Telescope 缓冲区' })
      vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Telescope 帮助标签' })
    end
  },
  { "numToStr/Comment.nvim", config = function() require("Comment").setup() end },
  { "windwp/nvim-autopairs", config = function() require("nvim-autopairs").setup() end },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      -- 你的配置写在这里
      -- 或者留空以使用默认设置
      -- 参考下面的配置部分
    },
    keys = {
      {
        "<leader>.",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "缓冲区本地键位映射（which-key）",
      },
    },
  },
  { "rafamadriz/friendly-snippets" },
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      -- 你的配置写在这里
      -- 或者留空以使用默认设置
    },
    keys = {
      {
        "<leader>xx",
        "<cmd>Trouble diagnostics toggle<cr>",
        desc = "诊断（Trouble）",
      },
      {
        "<leader>xX",
        "<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
        desc = "缓冲区诊断（Trouble）",
      },
      {
        "<leader>cs",
        "<cmd>Trouble symbols toggle focus=false<cr>",
        desc = "符号（Trouble）",
      },
      {
        "<leader>cl",
        "<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
        desc = "LSP 定义 / 引用 / ...（Trouble）",
      },
      {
        "<leader>xL",
        "<cmd>Trouble loclist toggle<cr>",
        desc = "位置列表（Trouble）",
      },
      {
        "<leader>xQ",
        "<cmd>Trouble qflist toggle<cr>",
        desc = "快速修复列表（Trouble）",
      },
    },
  },
  { "mfussenegger/nvim-dap" },
}
```


链接：
[1]: [Neovim: hyperextensible Vim-based text editor](https://neovim.io/)
[2]: Neovim 的现代插件管理器。详见 [lazy.nvim](https://github.com/folke/lazy.nvim)
[3]: `nvim-lspconfig` 是 Neovim LSP 客户端的配置集合，为各种语言服务器提供配置。详见 [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
[4]: 在 Neovim 中支持语法高亮和语言特定功能。详见 [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)

其他：
- 更多热门插件见 [Trending](https://dotfyle.com/neovim/plugins/trending)