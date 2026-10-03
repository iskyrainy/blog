---
title: Vim Nvim
category: Tech
tag: Vim
date: 2025-09-20T16:02:35+08:00
---


# Vim-nvim

## What is Neovim?
**Neovim**<sup>[1]</sup> is one of fork of *Vim*, aiming to improve the codebase, allowing for easier implementation of APIs, improved user experience and plugin implementation.

Neovim(nvim) is essentially a modernized, asynchronous, and highly extensible version of Vim, designed for better plugin support, IDE-like features, performance improvements, and Lua-based configuration, while retaining compatibility with most Vim workflows.

| Feature / Aspect                  | Vim                      | Neovim                                                                |
| --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| **Asynchronous Plugins**          | Limited / blocking       | Fully asynchronous, non-blocking                                      |
| **Language Server Protocol**      | External plugins only    | Built-in LSP client (`vim.lsp`)                                       |
| **Plugin Language Support**       | Vimscript                | Vimscript + Lua + remote plugins in any language (Python, Ruby, etc.) |
| **Configuration**                 | `vimrc` (Vimscript)      | `init.vim` (Vimscript) or `init.lua` (Lua)                            |
| **Embedded Terminal**             | Not built-in             | Built-in terminal (`:terminal`)                                       |
| **UI Architecture**               | Monolithic               | Core decoupled from UI → supports external GUIs                       |
| **Performance (Concurrency)**     | Single-threaded          | Event-loop + async jobs → smoother for heavy tasks                    |
| **Syntax Highlighting / Parsing** | Regex-based              | Treesitter integration → accurate parsing, folding, highlighting      |
| **Community & Development**       | Slower updates, stable   | Active development, modern plugin ecosystem                           |
| **Backward Compatibility**        | Fully supports Vimscript | Mostly compatible with Vimscript + new APIs                           |

Here we install nvim on Linux:
```bash
# change for your platform and arch
curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux-x86_64.tar.gz
sudo rm -rf /opt/nvim-linux-x86_64
sudo tar -C /opt -xzf nvim-linux-x86_64.tar.gz
# export nvim bin to Path
echo "export PATH=\$PATH:/opt/nvim-linux-x86_64/bin" >> ~/.bashrc
source ~/.bashrc
rm -f nvim-linux-x86_64.tar.gz
```

## Config neovim
`nivm` can be config in `lua` language. It's very easy to config editor, keymap and plugins etc.

There has a simple config structure as:
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

Let's see those `.lua` files:
- `init.lua`: Neovim config entrypoint, keeping reload this files
- `lua`:
    - `lua/core`: config editor and keybinding
        - `keymaps.lua`: config keybinding
        - `options.lua`: config editor
    - `lua/plugins`: config different plugins
        - `completion.lua`: code completion plugins
        - `git.lua`: git functional enhancements plugins
        - `init.lua`: init `lazy`<sup>[2]</sup> package manager
        - `lang.lua`: languages functional enhancements plugins
        - `lsp.lua`: config `nvim-lspconfig`<sup>[3]</sup> plugin
        - `treesitter.lua`: config `treesitter`<sup>[4]</sup> plugin
        - `ui.lua`: config theme/status line/files tree/buffer line/cursor enhancements
        - `utils.lua`: functional enhancements plugins, as: `telescope`, `Comment`, `autopairs`, `dap`, `trouble` etc.

> All config files are managed in repo [*iskyrainy/NvimConfig*](https://github.com/iskyrainy/NvimConfig).

### `init.lua`
```lua
-- base config
require("core.options")
require("core.keymaps")

-- plugins entrypoint
require("plugins")
```

### `lua/core/keymaps.lua`
```lua
vim.g.mapleader = ","
vim.g.maplocalleader = ","

local keymap = vim.keymap

-- ---------- insert mode ---------- ---
keymap.set("i", "jk", "<ESC>", { desc = "Exit insert mode" })

-- ---------- visual mode ---------- ---
keymap.set("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move line down" })
keymap.set("v", "K", ":m '<-2<CR>gv=gv", { desc = "Move line up" })
vim.keymap.set("v", "<leader>y", '"+y', { desc = "Yank to system clipboard" })

-- ---------- normal mode ---------- ---
-- window
-- horizontally build a window
vim.keymap.set("n", "<leader>sh", "<C-w>s", { desc = "Split window horizontally" })

-- vertically build a window
vim.keymap.set("n", "<leader>sv", "<C-w>v", { desc = "Split window vertically" })

-- close this window
vim.keymap.set("n", "<leader>sc", "<C-w>c", { desc = "Close current window" })

-- close all of other windows
vim.keymap.set("n", "<leader>so", "<C-w>o", { desc = "Close other windows" })


-- switch window by: <leader> + h/j/k/l
vim.keymap.set("n", "<leader>h", "<C-w>h", { desc = "Move to left window" })
vim.keymap.set("n", "<leader>l", "<C-w>l", { desc = "Move to right window" })
vim.keymap.set("n", "<leader>j", "<C-w>j", { desc = "Move to bottom window" })
vim.keymap.set("n", "<leader>k", "<C-w>k", { desc = "Move to top window" })

-- adjust window size by: Alt + h/j/k/l
vim.keymap.set("n", "<A-l>", "<C-w><", { desc = "Decrease width" })
vim.keymap.set("n", "<A-h>", "<C-w>>", { desc = "Increase width" })
vim.keymap.set("n", "<A-j>", "<C-w>-", { desc = "Decrease height" })
vim.keymap.set("n", "<A-k>", "<C-w>+", { desc = "Increase height" })

-- split all windows
vim.keymap.set("n", "<leader>se", "<C-w>=", { desc = "Equalize window sizes" })


-- dispose highlighting
keymap.set("n", "<leader>nh", ":nohl<CR>", { desc = "Close highlighting" })

-- switch buffer
keymap.set("n", "<leader>q", ":bd<CR>", { desc = "Close current buffer" })
keymap.set("n", "<F7>", ":bprevious<CR>", { desc = "Move to previous buffer" })
keymap.set("n", "<F8>", ":bnext<CR>", { desc = "Move to next buffer" })

-- system clipboard
vim.keymap.set("n", "<leader>p", '"+p', { desc = "Paste from system clipboard" })
vim.keymap.set("n", "<leader>y", '"+yy', { desc = "Yank line to system clipboard" })

-- ---------- plugins ---------- ---
-- nvim-tree
vim.keymap.set("n", "<F4>", "<cmd>NvimTreeToggle<CR>", { noremap = true, silent = true }, { desc = "Open/Close file tree" })

-- treesitter
vim.keymap.set("n", "<leader>f", "gg=G", { desc = "Format code" })

-- lsp
vim.keymap.set("n", "ga", vim.diagnostic.open_float, { desc = "Open diagnostic info" })
vim.keymap.set("n", "gk", vim.diagnostic.goto_prev, { desc = "Move to previous diagnostic info" })
vim.keymap.set("n", "gj", vim.diagnostic.goto_next, { desc = "Move to next diagnostic info" })
vim.keymap.set("n", "gd", vim.lsp.buf.definition, { desc = "Jump to definition" })
vim.keymap.set("n", "gD", vim.lsp.buf.declaration, { desc = "Jump to declaration" })
vim.keymap.set("n", "gt", vim.lsp.buf.type_definition, { desc = "Jump to type_definition" })
vim.keymap.set("n", "gi", vim.lsp.buf.implementation, { desc = "Jump to implementation" })
vim.keymap.set("n", "gr", vim.lsp.buf.references, { desc = "Show all references" })
vim.keymap.set("n", "K", vim.lsp.buf.hover, { desc = "Show hover info" })
vim.keymap.set("n", "<leader>rn", vim.lsp.buf.rename, {desc = "Rename var's name" } )
vim.keymap.set({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, { desc = "Code action" })
vim.keymap.set("n", "<leader>fm", function()
  vim.lsp.buf.format({ async = true })
end)

-- autocmd
-- auto reload rust-analyzer when Cargo.toml is changed
vim.api.nvim_create_autocmd("BufWritePost", {
  pattern = "Cargo.toml",
  callback = function()
    vim.lsp.buf.execute_command({ command = "rust-analyzer.reloadWorkspace" })
  end,
})

-- auto save file changes
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

-- line number
opt.relativenumber = true
opt.number = true

-- tab
opt.tabstop = 2
opt.shiftwidth = 2
opt.expandtab = true
opt.autoindent = true

-- not wrap
opt.wrap = false

-- cursor line
opt.cursorline = true

-- start mouse
opt.mouse:append("a")

-- system clipboard
-- need install `xclip`/`xsel` in Linux or `pbcopy`/`pbpaste` in MacOS
opt.clipboard:append("unnamedplus")

-- new window position
opt.splitright = true
opt.splitbelow = true

-- search
opt.ignorecase = true
opt.smartcase = true

-- theme
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
-- lazy.nvim init
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
  -- Mason: LSP/DAP/tool installer
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
      -- config lsp servers that you need
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
        -- config languages that you need
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
  -- theme
  { "Mofiqul/vscode.nvim", config = function() vim.cmd.colorscheme "vscode" end },

  -- status line
  { "nvim-lualine/lualine.nvim", dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function() require("lualine").setup({ options = { theme = "vscode" } }) end
  },

  -- files tree
  { "nvim-tree/nvim-tree.lua", dependencies = { "nvim-tree/nvim-web-devicons" },
    config = function() require("nvim-tree").setup() end
  },

  -- buffer line
  { "akinsho/bufferline.nvim", dependencies = "nvim-tree/nvim-web-devicons",
    config = function() require("bufferline").setup() end
  },

  -- cursor enhancements
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
  -- need install `ripgrep`/`fd` in system
  { "nvim-telescope/telescope.nvim", tag = "0.1.8", dependencies = { "nvim-lua/plenary.nvim" },
    config = function()
      local builtin = require('telescope.builtin')
      vim.keymap.set('n', '<leader>ff', builtin.find_files, { desc = 'Telescope find files' })
      vim.keymap.set('n', '<leader>fg', builtin.live_grep, { desc = 'Telescope live grep' })
      vim.keymap.set('n', '<leader>fb', builtin.buffers, { desc = 'Telescope buffers' })
      vim.keymap.set('n', '<leader>fh', builtin.help_tags, { desc = 'Telescope help tags' })
    end
  },
  { "numToStr/Comment.nvim", config = function() require("Comment").setup() end },
  { "windwp/nvim-autopairs", config = function() require("nvim-autopairs").setup() end },
  {
    "folke/which-key.nvim",
    event = "VeryLazy",
    opts = {
      -- your configuration comes here
      -- or leave it empty to use the default settings
      -- refer to the configuration section below
    },
    keys = {
      {
        "<leader>.",
        function()
          require("which-key").show({ global = false })
        end,
        desc = "Buffer Local Keymaps (which-key)",
      },
    },
  },
  { "rafamadriz/friendly-snippets" },
  {
    "folke/trouble.nvim",
    dependencies = { "nvim-tree/nvim-web-devicons" },
    opts = {
      -- your configuration comes here
      -- or leave it empty to use the default settings
    },
    keys = {
      {
        "<leader>xx",
        "<cmd>Trouble diagnostics toggle<cr>",
        desc = "Diagnostics (Trouble)",
      },
      {
        "<leader>xX",
        "<cmd>Trouble diagnostics toggle filter.buf=0<cr>",
        desc = "Buffer Diagnostics (Trouble)",
      },
      {
        "<leader>cs",
        "<cmd>Trouble symbols toggle focus=false<cr>",
        desc = "Symbols (Trouble)",
      },
      {
        "<leader>cl",
        "<cmd>Trouble lsp toggle focus=false win.position=right<cr>",
        desc = "LSP Definitions / references / ... (Trouble)",
      },
      {
        "<leader>xL",
        "<cmd>Trouble loclist toggle<cr>",
        desc = "Location List (Trouble)",
      },
      {
        "<leader>xQ",
        "<cmd>Trouble qflist toggle<cr>",
        desc = "Quickfix List (Trouble)",
      },
    },
  },
  { "mfussenegger/nvim-dap" },
}
```


Links:
[1]: [Neovim: hyperextensible Vim-based text editor](https://neovim.io/)
[2]: A modern plugin manager for Neovim. See more [lazy.nvim](https://github.com/folke/lazy.nvim)
[3]: `nvim-lspconfig` is a collection of configurations for the Neovim LSP client, providing setups for various language servers. See more [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
[4]: Support for syntax highlighting and language-specific features in Neovim. See more [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)

Other:
- More trending plugins see [Trending](https://dotfyle.com/neovim/plugins/trending)